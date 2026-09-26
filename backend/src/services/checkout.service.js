const crypto = require("node:crypto");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { STAFF } = require("../utils/roles");
const { visibilityFilter } = require("./advertisement.service");
const eventNotifications = require("./eventNotifications");
const kpayService = require("./kpay.service");
const paymentService = require("./payment.service");
const orderService = require("./order.service");

/*
 * Cart checkout: one reference, one payment, one order line per listing.
 *
 * A CheckoutGroup is what the buyer sees as "their order" (SM-XXXXXX). Underneath, every
 * listing becomes its own Order exactly as before, so escrow, delivery confirmation,
 * disputes, reviews and the seller screens keep working unchanged. A Mobile Money payment
 * covers the whole group; cash on delivery confirms every line at once.
 *
 * Guests order without an account: a GUEST user row (name, phone, optional email) holds
 * their lines, and the group's access token (in the tracking link) authorises follow-up
 * actions. Registering later with the same email upgrades that row into a real account.
 */

const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const STALE_PENDING_MS = 30 * 60 * 1000;

const groupInclude = {
  buyer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
  payment: true,
  orders: {
    orderBy: { createdAt: "asc" },
    include: {
      advertisement: { select: { id: true, title: true, slug: true, price: true, images: true, store: { select: { id: true, name: true, slug: true, acceptsCashOnDelivery: true } } } },
      escrow: true,
    },
  },
};

const makeToken = () => crypto.randomBytes(24).toString("base64url");
const randomReference = () => "SM-" + Array.from(crypto.randomBytes(6), (b) => REFERENCE_ALPHABET[b % REFERENCE_ALPHABET.length]).join("");
const digits = (phone) => String(phone ?? "").replace(/\D/g, "").replace(/^237/, "");
/** Canonical storage form for a guest phone: +237XXXXXXXXX for Cameroon numbers, +<digits> otherwise. */
const canonicalPhone = (phone) => {
  const raw = String(phone ?? "").replace(/\D/g, "");
  const local = raw.replace(/^237/, "");
  return local.length === 9 ? `+237${local}` : `+${raw}`;
};
/** Every spelling under which the same number may already be stored on a user row. */
const phoneSpellings = (phone) => {
  const d = digits(phone);
  return [...new Set([canonicalPhone(phone), String(phone).trim(), d, `237${d}`, `+237${d}`])];
};

async function uniqueReference(tx) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const reference = randomReference();
    // eslint-disable-next-line no-await-in-loop -- rare collision retry
    if (!(await tx.checkoutGroup.findUnique({ where: { reference } }))) return reference;
  }
  throw new Error("Could not allocate an order reference.");
}

/** A guest becomes (or reuses) a GUEST user row keyed on email, else phone. */
async function resolveGuestBuyer({ name, email, phone }) {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  const lastName = rest.join(" ");
  const normalisedEmail = email?.trim().toLowerCase() || null;
  const normalisedPhone = canonicalPhone(phone);

  const withPhone = async (id, data) => {
    try {
      return await prisma.user.update({ where: { id }, data: { ...data, phone: normalisedPhone } });
    } catch {
      return prisma.user.update({ where: { id }, data }); // phone already used by another row: keep the old one
    }
  };

  if (normalisedEmail) {
    const byEmail = await prisma.user.findUnique({ where: { email: normalisedEmail } });
    if (byEmail) {
      if (byEmail.status !== "GUEST") throw new ApiError(409, "This email already has an account. Please sign in to order.", "EMAIL_HAS_ACCOUNT");
      return withPhone(byEmail.id, { firstName, lastName });
    }
  }
  const byPhone = await prisma.user.findFirst({ where: { phone: { in: phoneSpellings(phone) } } });
  if (byPhone) {
    if (byPhone.status !== "GUEST") throw new ApiError(409, "This phone number belongs to an account. Please sign in to order.", "PHONE_HAS_ACCOUNT");
    return prisma.user.update({ where: { id: byPhone.id }, data: { firstName, lastName, ...(normalisedEmail && { email: normalisedEmail }) } });
  }
  return prisma.user.create({
    data: {
      email: normalisedEmail ?? `guest-${crypto.randomBytes(5).toString("hex")}@guest.smartplaze.invalid`,
      firstName,
      lastName,
      phone: normalisedPhone,
      status: "GUEST",
    },
  });
}

async function getById(id) {
  const group = await prisma.checkoutGroup.findUnique({ where: { id }, include: groupInclude });
  if (!group) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");
  return group;
}

/** The buyer, a valid tracking token, or staff. */
async function getForRequester(id, { user, token } = {}) {
  const group = await getById(id);
  const allowed = (user && group.buyerId === user.id) || (user && STAFF.includes(user.role)) || (token && token === group.accessToken);
  if (!allowed) throw new ApiError(403, "This order does not belong to you.", "FORBIDDEN");
  return group;
}

/** Guest follow-up without the link: reference + the phone used at checkout. */
async function lookup({ reference, phone }) {
  const notFound = () => new ApiError(404, "No order matches this reference and phone number.", "ORDER_NOT_FOUND");
  const group = await prisma.checkoutGroup.findUnique({ where: { reference: reference.trim().toUpperCase() }, include: groupInclude });
  if (!group) throw notFound();
  const known = [group.deliveryPhone, group.payment?.phoneNumber, group.buyer.phone].filter(Boolean).map(digits);
  if (!known.includes(digits(phone))) throw notFound();
  return group;
}

async function create({ user, guest, items, paymentMethod = "MOBILE_MONEY", deliveryAddress, deliveryPhone }) {
  if (!user && !guest) throw new ApiError(401, "Sign in or continue as a guest to order.", "GUEST_DETAILS_REQUIRED");
  if (user && !user.emailVerifiedAt) throw new ApiError(403, "Please verify your email address first.", "EMAIL_NOT_VERIFIED");
  const buyer = user ?? (await resolveGuestBuyer(guest));

  const wanted = new Map();
  for (const { advertisementId, quantity } of items) wanted.set(advertisementId, (wanted.get(advertisementId) ?? 0) + quantity);

  const ads = await prisma.advertisement.findMany({
    where: { id: { in: [...wanted.keys()] }, ...visibilityFilter(), store: { ...visibilityFilter().store, status: "ACTIVE" } },
    include: { store: { select: { id: true, name: true, ownerId: true, acceptsCashOnDelivery: true } } },
  });
  if (ads.length !== wanted.size) {
    throw new ApiError(422, "Some items in your cart are no longer available. Remove them and try again.", "SOME_ITEMS_UNAVAILABLE");
  }
  if (ads.some((ad) => ad.store.ownerId === buyer.id)) throw new ApiError(422, "You cannot buy your own listing.", "CANNOT_BUY_OWN_LISTING");

  const cashOnDelivery = paymentMethod === "CASH_ON_DELIVERY";
  if (cashOnDelivery) {
    const refusing = [...new Set(ads.filter((ad) => !ad.store.acceptsCashOnDelivery).map((ad) => ad.store.name))];
    if (refusing.length) throw new ApiError(422, `Cash on delivery is not offered by: ${refusing.join(", ")}.`, "COD_NOT_ACCEPTED");
  }

  const lines = ads.map((ad) => ({ ad, quantity: wanted.get(ad.id), total: Number(ad.price) * wanted.get(ad.id) }));
  const totalAmount = lines.reduce((sum, l) => sum + l.total, 0);
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);

  const created = await prisma.$transaction(async (tx) => {
    const group = await tx.checkoutGroup.create({
      data: {
        reference: await uniqueReference(tx),
        accessToken: makeToken(),
        buyerId: buyer.id,
        isGuest: buyer.status === "GUEST",
        paymentMethod,
        totalAmount,
        itemCount,
        deliveryAddress: deliveryAddress ?? null,
        deliveryPhone: deliveryPhone ?? null,
      },
    });
    for (const line of lines) {
      // eslint-disable-next-line no-await-in-loop -- inside one transaction, order of lines preserved
      await tx.order.create({
        data: {
          buyerId: buyer.id,
          advertisementId: line.ad.id,
          quantity: line.quantity,
          totalAmount: line.total,
          paymentMethod,
          deliveryAddress: deliveryAddress ?? null,
          deliveryPhone: deliveryPhone ?? null,
          status: cashOnDelivery ? "CONFIRMED" : "PENDING_PAYMENT",
          groupId: group.id,
        },
      });
    }
    return group;
  });

  const group = await getById(created.id);
  if (cashOnDelivery) for (const order of group.orders) void eventNotifications.codOrderPlaced(order.id);
  return group;
}

/** One Mobile Money payment for every line still awaiting payment. */
async function pay(id, requester, { provider, phoneNumber }) {
  const group = await getForRequester(id, requester);
  if (group.paymentMethod === "CASH_ON_DELIVERY") throw new ApiError(409, "This order is paid in cash on delivery.", "ORDER_NOT_PAYABLE");
  const payable = group.orders.filter((o) => o.status === "PENDING_PAYMENT");
  if (payable.length === 0) throw new ApiError(409, "This order has already been paid or is no longer payable.", "ORDER_NOT_PAYABLE");

  if (group.payment) {
    const inFlight = ["PENDING", "PROCESSING"].includes(group.payment.status);
    const isStale = Date.now() - group.payment.createdAt.getTime() > STALE_PENDING_MS;
    if (inFlight && !isStale) throw new ApiError(409, "A payment for this order is already in progress.", "PAYMENT_IN_PROGRESS");
    if (inFlight && group.payment.providerPaymentId) {
      try {
        const live = await kpayService.getPaymentStatus(group.payment.providerPaymentId);
        await paymentService.applyStatusUpdate({ externalId: group.payment.externalId, providerPaymentId: live.id, providerReference: live.reference, status: live.status, failureReason: live.failureReason });
        if (live.status === "COMPLETED") throw new ApiError(409, "Your previous payment has just completed.", "ORDER_NOT_PAYABLE");
      } catch (err) {
        if (err instanceof ApiError) throw err;
      }
    }
    const { count } = await prisma.payment.deleteMany({ where: { id: group.payment.id, status: { notIn: ["COMPLETED"] } } });
    if (count === 0) throw new ApiError(409, "This order has already been paid.", "ORDER_NOT_PAYABLE");
  }

  const amount = payable.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const externalId = `group-${group.id}-${crypto.randomBytes(6).toString("hex")}`;
  const payment = await prisma.payment.create({
    data: { groupId: group.id, amount, externalId, provider: "KPAY", operator: provider, phoneNumber, status: "PENDING" },
  });

  let kpayResponse;
  try {
    kpayResponse = await kpayService.initPayment({
      amount,
      provider,
      phoneNumber,
      externalId,
      description: `SmartPlaze order ${group.reference} (${group.itemCount} item${group.itemCount === 1 ? "" : "s"})`,
      metadata: { groupId: group.id, reference: group.reference },
    });
  } catch (err) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: err.message } });
    throw err;
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { providerPaymentId: kpayResponse.id, providerReference: kpayResponse.reference, status: paymentService.mapStatus(kpayResponse.status) },
  });
  return { group: await getById(group.id), payment: updated, message: kpayResponse.message || "Payment initiated — approve it on your phone." };
}

/** Buyer-side actions on one line of the group, authorised by login or tracking token. */
async function lineRequester(id, orderId, requester) {
  const group = await getForRequester(id, requester);
  const order = group.orders.find((o) => o.id === orderId);
  if (!order) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");
  return { group, buyerId: group.buyerId };
}

async function confirmReceipt(id, orderId, requester) {
  const { buyerId } = await lineRequester(id, orderId, requester);
  return orderService.confirmReceipt(orderId, buyerId);
}

async function cancelLine(id, orderId, requester, reason) {
  const { buyerId } = await lineRequester(id, orderId, requester);
  return orderService.cancel(orderId, { id: buyerId, role: "CUSTOMER" }, reason);
}

async function listMine(buyerId, { page = 1, pageSize = 20 } = {}) {
  const where = { buyerId };
  const [items, total] = await Promise.all([
    prisma.checkoutGroup.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: groupInclude }),
    prisma.checkoutGroup.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

module.exports = { create, pay, getById, getForRequester, lookup, confirmReceipt, cancelLine, listMine, resolveGuestBuyer };
