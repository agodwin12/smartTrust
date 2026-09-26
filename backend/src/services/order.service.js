const crypto = require("crypto");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { STAFF } = require("../utils/roles");
const kpayService = require("./kpay.service");
const paymentService = require("./payment.service");
const escrowService = require("./escrow.service");
const eventNotifications = require("./eventNotifications");
const { visibilityFilter } = require("./advertisement.service");

// See subscription.service.js — an abandoned Mobile Money prompt never resolves.
const STALE_PENDING_MS = 30 * 60 * 1000;

async function create(buyerId, { advertisementId, quantity = 1, paymentMethod = "MOBILE_MONEY", deliveryAddress, deliveryPhone }) {
  // The same visibility rule the public browse uses — "PUBLISHED" alone isn't
  // enough. Otherwise anyone holding an old listing id could still order from a
  // store whose subscription has lapsed (or that was suspended), even though the
  // listing is no longer shown anywhere.
  const ad = await prisma.advertisement.findFirst({
    where: { id: advertisementId, ...visibilityFilter(), store: { ...visibilityFilter().store, status: "ACTIVE" } },
    include: { store: { select: { ownerId: true, acceptsCashOnDelivery: true } } },
  });

  if (!ad) {
    throw new ApiError(404, "Advertisement not found.", "ADVERTISEMENT_NOT_FOUND");
  }
  if (ad.store.ownerId === buyerId) {
    throw new ApiError(422, "You cannot buy your own listing.", "CANNOT_BUY_OWN_LISTING");
  }
  const cashOnDelivery = paymentMethod === "CASH_ON_DELIVERY";
  if (cashOnDelivery && !ad.store.acceptsCashOnDelivery) {
    throw new ApiError(422, "This seller does not accept cash on delivery.", "COD_NOT_ACCEPTED");
  }

  const totalAmount = Number(ad.price) * quantity;

  // Cash on delivery skips escrow entirely: the order is confirmed immediately, the seller
  // delivers and collects the cash, and both sides confirm the handover like any other order.
  const order = await prisma.order.create({
    data: {
      buyerId,
      advertisementId,
      quantity,
      totalAmount,
      paymentMethod,
      deliveryAddress: deliveryAddress ?? null,
      deliveryPhone: deliveryPhone ?? null,
      status: cashOnDelivery ? "CONFIRMED" : "PENDING_PAYMENT",
    },
  });
  if (cashOnDelivery) void eventNotifications.codOrderPlaced(order.id);
  return order;
}

async function findAsBuyer(orderId, buyerId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");
  if (order.buyerId !== buyerId) throw new ApiError(403, "This order does not belong to you.", "FORBIDDEN");
  return order;
}

async function pay(orderId, buyerId, { provider, phoneNumber }) {
  const order = await findAsBuyer(orderId, buyerId);
  if (order.paymentMethod === "CASH_ON_DELIVERY") {
    throw new ApiError(409, "This order is paid in cash on delivery — no Mobile Money payment is needed.", "ORDER_NOT_PAYABLE");
  }
  if (order.status !== "PENDING_PAYMENT") {
    throw new ApiError(409, "This order has already been paid or is no longer payable.", "ORDER_NOT_PAYABLE");
  }

  // A previous attempt on this order (Payment.orderId is unique) — if it's still
  // in flight, don't start another one; if it died, clear it so this attempt can
  // create a fresh row instead of hitting the unique constraint.
  const existingPayment = await prisma.payment.findUnique({ where: { orderId: order.id } });
  if (existingPayment) {
    const inFlight = ["PENDING", "PROCESSING"].includes(existingPayment.status);
    const isStale = Date.now() - existingPayment.createdAt.getTime() > STALE_PENDING_MS;

    if (inFlight && !isStale) {
      throw new ApiError(409, "A payment for this order is already in progress.", "PAYMENT_IN_PROGRESS");
    }

    if (inFlight && isStale && existingPayment.providerPaymentId) {
      // Last chance for a late approval before the attempt is written off.
      try {
        const live = await kpayService.getPaymentStatus(existingPayment.providerPaymentId);
        await paymentService.applyStatusUpdate({
          externalId: existingPayment.externalId,
          providerPaymentId: live.id,
          providerReference: live.reference,
          status: live.status,
          failureReason: live.failureReason,
        });
        if (live.status === "COMPLETED") {
          throw new ApiError(409, "Your previous payment for this order has just completed.", "ORDER_NOT_PAYABLE");
        }
      } catch (err) {
        if (err instanceof ApiError && err.code === "ORDER_NOT_PAYABLE") throw err;
      }
    }

    // Conditional: only clears a payment that is still non-terminal (a webhook
    // completing it this instant would flip it to COMPLETED first and we'd stop).
    const { count } = await prisma.payment.deleteMany({
      where: { id: existingPayment.id, status: { notIn: ["COMPLETED"] } },
    });
    if (count === 0) {
      throw new ApiError(409, "This order has already been paid.", "ORDER_NOT_PAYABLE");
    }
  }

  // Unique per attempt, not just per order — a retry must use a fresh externalId,
  // otherwise K-Pay's own idempotency check would reject it as a duplicate.
  const externalId = `order-${order.id}-${crypto.randomBytes(6).toString("hex")}`;
  const amount = Number(order.totalAmount);

  const payment = await prisma.payment.create({
    data: { orderId: order.id, amount, externalId, provider: "KPAY", operator: provider, phoneNumber, status: "PENDING" },
  });

  let kpayResponse;
  try {
    kpayResponse = await kpayService.initPayment({
      amount,
      provider,
      phoneNumber,
      externalId,
      description: `SmartPlaze order — ${order.id}`,
      metadata: { orderId: order.id },
    });
  } catch (err) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: err.message } });
    throw err;
  }

  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      providerPaymentId: kpayResponse.id,
      providerReference: kpayResponse.reference,
      status: paymentService.mapStatus(kpayResponse.status),
    },
  });

  return { order, payment: updatedPayment, message: kpayResponse.message || "Payment initiated — approve it on your phone." };
}

/** Both sides must validate before funds move — neither confirmation alone completes the order. */
async function maybeComplete(order) {
  if (!(order.sellerConfirmedAt && order.buyerConfirmedAt)) return;
  if (order.status === "PAID") {
    await escrowService.release(order.id);
    void eventNotifications.orderCompleted(order.id);
  } else if (order.status === "CONFIRMED") {
    // Cash on delivery: nothing to release — the seller already holds the money.
    const { count } = await prisma.order.updateMany({ where: { id: order.id, status: "CONFIRMED" }, data: { status: "COMPLETED" } });
    if (count === 1) void eventNotifications.orderCompleted(order.id);
  }
}

const AWAITING_HANDOVER = ["PAID", "CONFIRMED"];

async function confirmDelivery(orderId, sellerId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { advertisement: { select: { storeId: true, store: { select: { ownerId: true } } } } },
  });
  if (!order) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");
  if (order.advertisement.store.ownerId !== sellerId) {
    throw new ApiError(403, "This order does not belong to your store.", "FORBIDDEN");
  }
  if (!AWAITING_HANDOVER.includes(order.status)) {
    throw new ApiError(409, "This order is not awaiting delivery confirmation.", "ORDER_NOT_PAID");
  }

  const updated = await prisma.order.update({ where: { id: orderId }, data: { sellerConfirmedAt: new Date() } });
  void eventNotifications.deliveryConfirmed(orderId);
  await maybeComplete(updated);
  return prisma.order.findUnique({ where: { id: orderId } });
}

async function confirmReceipt(orderId, buyerId) {
  const order = await findAsBuyer(orderId, buyerId);
  if (!AWAITING_HANDOVER.includes(order.status)) {
    throw new ApiError(409, "This order is not awaiting receipt confirmation.", "ORDER_NOT_PAID");
  }

  const updated = await prisma.order.update({ where: { id: orderId }, data: { buyerConfirmedAt: new Date() } });
  void eventNotifications.receiptConfirmed(orderId);
  await maybeComplete(updated);
  return prisma.order.findUnique({ where: { id: orderId } });
}

async function raiseDispute(orderId, requester, reason) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { advertisement: { select: { store: { select: { ownerId: true } } } } },
  });
  if (!order) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");

  const isBuyer = order.buyerId === requester.id;
  const isSeller = order.advertisement.store.ownerId === requester.id;
  if (!isBuyer && !isSeller) {
    throw new ApiError(403, "This order does not involve you.", "FORBIDDEN");
  }
  if (order.paymentMethod === "CASH_ON_DELIVERY") {
    throw new ApiError(409, "Cash-on-delivery orders are not covered by escrow and cannot be disputed. Cancel before the handover or contact support.", "ORDER_NOT_DISPUTABLE");
  }
  if (order.status !== "PAID") {
    throw new ApiError(409, "A dispute can only be raised on a paid, unsettled order.", "ORDER_NOT_DISPUTABLE");
  }

  const [, dispute] = await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: "DISPUTED" } }),
    prisma.dispute.create({ data: { orderId, raisedById: requester.id, reason, status: "OPEN" } }),
  ]);
  void eventNotifications.disputeCreated(orderId, requester.id);

  return dispute;
}

/**
 * Cancels an order that has not been handed over yet. Cash-on-delivery orders can be
 * cancelled by either side until the seller confirms delivery; an unpaid Mobile Money order
 * can be cancelled by its buyer as long as no payment is in flight. Paid (escrowed) orders go
 * through the dispute flow instead — money only ever moves through escrow.service.
 */
async function cancel(orderId, requester, reason) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: { select: { status: true } }, advertisement: { select: { store: { select: { ownerId: true } } } } },
  });
  if (!order) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");
  const isBuyer = order.buyerId === requester.id;
  const isSeller = order.advertisement.store.ownerId === requester.id;
  if (!isBuyer && !isSeller) throw new ApiError(403, "This order does not involve you.", "FORBIDDEN");

  let allowed = false;
  if (order.status === "CONFIRMED" && !order.sellerConfirmedAt) allowed = true;
  if (order.status === "PENDING_PAYMENT" && isBuyer && !["PENDING", "PROCESSING"].includes(order.payment?.status)) allowed = true;
  if (!allowed) {
    throw new ApiError(409, "This order can no longer be cancelled.", "ORDER_NOT_CANCELLABLE");
  }

  const cancelledBy = isBuyer ? "BUYER" : "SELLER";
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, status: order.status, sellerConfirmedAt: null },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy, cancelReason: reason || null },
  });
  if (count === 0) throw new ApiError(409, "This order can no longer be cancelled.", "ORDER_NOT_CANCELLABLE");
  void eventNotifications.orderCancelled(orderId, cancelledBy, reason);
  return prisma.order.findUnique({ where: { id: orderId } });
}

async function getById(orderId, requester) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      advertisement: { include: { store: true } },
      payment: true,
      escrow: true,
      refund: true,
      disputes: { orderBy: { createdAt: "desc" } },
      review: true,
      buyer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      group: { select: { id: true, reference: true, itemCount: true, isGuest: true } },
    },
  });
  if (!order) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");

  const isOwner = order.buyerId === requester.id || order.advertisement.store.ownerId === requester.id;
  if (!isOwner && !STAFF.includes(requester.role)) {
    throw new ApiError(403, "This order does not involve you.", "FORBIDDEN");
  }

  return order;
}

async function listMineAsBuyer(buyerId, { page = 1, pageSize = 20 } = {}) {
  const where = { buyerId };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { advertisement: { select: { title: true, slug: true, images: true } }, group: { select: { id: true, reference: true, itemCount: true } } },
    }),
    prisma.order.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

async function listForStore(storeId, { page = 1, pageSize = 20 } = {}) {
  const where = { advertisement: { storeId } };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        advertisement: { select: { title: true, slug: true, images: true, price: true } },
        buyer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

/** Staff-wide view of every order on the platform. */
async function listAll({ page = 1, pageSize = 20, status, buyerId, storeId } = {}) {
  const where = {
    ...(status && { status }),
    ...(buyerId && { buyerId }),
    ...(storeId && { advertisement: { storeId } }),
  };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        buyer: { select: { id: true, email: true, firstName: true, lastName: true } },
        advertisement: { select: { id: true, title: true, slug: true, store: { select: { id: true, name: true, slug: true } } } },
        escrow: { select: { status: true, amount: true } },
        payment: { select: { status: true, providerReference: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

module.exports = {
  create,
  pay,
  confirmDelivery,
  confirmReceipt,
  raiseDispute,
  getById,
  cancel,
  listMineAsBuyer,
  listForStore,
  listAll,
};
