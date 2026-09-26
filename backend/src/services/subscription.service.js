const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const kpayService = require("./kpay.service");
const paymentService = require("./payment.service");

// K-Pay's docs are explicit that an abandoned USSD prompt (customer just closes
// it) stays PENDING forever and never sends a webhook. Without this, one
// abandoned attempt would lock a seller out of subscribing for good — the old
// "409 while a payment is in progress" guard had no way out.
const STALE_PENDING_MS = 30 * 60 * 1000;

async function checkout(storeId, { planId, provider, phoneNumber }) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) {
    throw new ApiError(404, "Subscription plan not found.", "PLAN_NOT_FOUND");
  }

  const pendingExisting = await prisma.subscription.findFirst({
    where: { storeId, status: "PENDING_PAYMENT" },
    include: { payment: true },
  });

  if (pendingExisting) {
    const isStale = Date.now() - pendingExisting.createdAt.getTime() > STALE_PENDING_MS;
    if (!isStale) {
      throw new ApiError(
        409,
        "You already have a subscription payment in progress. Complete it or wait a few minutes before starting a new one.",
        "SUBSCRIPTION_PAYMENT_IN_PROGRESS"
      );
    }

    // Before writing it off, one last live check — if the customer did approve
    // late, this activates it and the seller doesn't need a new one at all.
    if (pendingExisting.payment?.providerPaymentId) {
      try {
        const live = await kpayService.getPaymentStatus(pendingExisting.payment.providerPaymentId);
        await paymentService.applyStatusUpdate({
          externalId: pendingExisting.payment.externalId,
          providerPaymentId: live.id,
          providerReference: live.reference,
          status: live.status,
          failureReason: live.failureReason,
        });
        if (live.status === "COMPLETED") {
          throw new ApiError(409, "Your previous subscription payment has just completed.", "SUBSCRIPTION_ALREADY_ACTIVE");
        }
      } catch (err) {
        if (err instanceof ApiError && err.code === "SUBSCRIPTION_ALREADY_ACTIVE") throw err;
        // K-Pay unreachable / rejected the lookup — fall through and abandon it.
      }
    }

    // Conditional on still being pending, so a webhook landing this exact instant wins.
    await prisma.$transaction([
      prisma.subscription.updateMany({
        where: { id: pendingExisting.id, status: "PENDING_PAYMENT" },
        data: { status: "CANCELLED" },
      }),
      prisma.payment.updateMany({
        where: { subscriptionId: pendingExisting.id, status: { in: ["PENDING", "PROCESSING"] } },
        data: { status: "CANCELLED", failureReason: "Abandoned — no confirmation within 30 minutes." },
      }),
    ]);
  }

  const subscription = await prisma.subscription.create({
    data: { storeId, planId, status: "PENDING_PAYMENT" },
  });

  const externalId = `sub-${subscription.id}`;
  const amount = Number(plan.price);

  const payment = await prisma.payment.create({
    data: {
      subscriptionId: subscription.id,
      amount,
      operator: provider,
      externalId,
      provider: "KPAY",
      phoneNumber,
      status: "PENDING",
    },
  });

  let kpayResponse;
  try {
    kpayResponse = await kpayService.initPayment({
      amount,
      provider,
      phoneNumber,
      externalId,
      description: `SmartPlaze subscription — ${plan.name}`,
      metadata: { subscriptionId: subscription.id, planId: plan.id, storeId },
    });
  } catch (err) {
    // Don't leave a dangling PENDING_PAYMENT subscription if K-Pay rejected the request outright.
    await prisma.subscription.update({ where: { id: subscription.id }, data: { status: "CANCELLED" } });
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

  return {
    subscription,
    payment: updatedPayment,
    message: kpayResponse.message || "Payment initiated — approve it on your phone.",
  };
}

/** The store's current plan: the active, unexpired subscription if there is one, otherwise the latest attempt (pending / cancelled / expired). */
async function getMine(storeId) {
  const include = { plan: true, payment: true };
  const active = await prisma.subscription.findFirst({
    where: { storeId, status: "ACTIVE", expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
    include,
  });
  if (active) return active;
  return prisma.subscription.findFirst({ where: { storeId }, orderBy: { createdAt: "desc" }, include });
}

/** Re-checks the live status with K-Pay for a still-pending payment and applies any change. */
async function refreshStatus(subscriptionId, storeId) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, payment: true, store: true },
  });

  if (!subscription) throw new ApiError(404, "Subscription not found.", "SUBSCRIPTION_NOT_FOUND");
  if (subscription.storeId !== storeId) {
    throw new ApiError(403, "This subscription does not belong to you.", "FORBIDDEN");
  }

  if (subscription.payment && ["PENDING", "PROCESSING"].includes(subscription.payment.status)) {
    const live = await kpayService.getPaymentStatus(
      subscription.payment.providerPaymentId || subscription.payment.externalId
    );
    await paymentService.applyStatusUpdate({
      externalId: subscription.payment.externalId,
      providerPaymentId: live.id,
      providerReference: live.reference,
      status: live.status,
      failureReason: live.failureReason,
    });
  }

  return prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, payment: true },
  });
}

module.exports = { checkout, getMine, refreshStatus };
