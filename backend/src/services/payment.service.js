const prisma = require("../config/prisma");
const auditService = require("./audit.service");
const eventNotifications = require("./eventNotifications");

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

/** Maps a K-Pay payment status onto our own PaymentStatus enum values. */
function mapStatus(kpayStatus) {
  if (kpayStatus === "COMPLETED") return "COMPLETED";
  if (kpayStatus === "FAILED") return "FAILED";
  if (kpayStatus === "CANCELLED") return "CANCELLED";
  if (kpayStatus === "PROCESSING") return "PROCESSING";
  return "PENDING";
}

/**
 * Applies a status update coming from K-Pay (webhook OR a live status re-check)
 * to our Payment row, and — only once, on the PENDING/PROCESSING → COMPLETED
 * transition — activates whatever the payment was for. Safe to call repeatedly
 * AND safe to call concurrently: K-Pay's own webhook retries, a duplicate
 * delivery, and our own polling can all race each other here. The guard is the
 * conditional `updateMany({ where: { status: { notIn: [...terminal] } } })` —
 * Postgres serializes concurrent updates to the same row, so only the call that
 * actually flips the status (`count === 1`) goes on to activate a subscription
 * or open an escrow hold; every other concurrent caller sees `count === 0` and
 * just returns the current (already-updated) row.
 */
async function applyStatusUpdate({ externalId, providerPaymentId, providerReference, status, failureReason }) {
  const payment = await prisma.payment.findUnique({
    where: { externalId },
    include: { subscription: { include: { plan: true } }, order: true },
  });

  if (!payment) return null;
  if (TERMINAL_STATUSES.has(payment.status)) return payment; // fast path — avoids a wasted transaction on obvious retries

  const nextStatus = mapStatus(status);

  const wonRace = await prisma.$transaction(async (tx) => {
    const { count } = await tx.payment.updateMany({
      where: { id: payment.id, status: { notIn: [...TERMINAL_STATUSES] } },
      data: {
        status: nextStatus,
        providerPaymentId: providerPaymentId ?? payment.providerPaymentId,
        providerReference: providerReference ?? payment.providerReference,
        failureReason: failureReason ?? null,
        ...(nextStatus === "COMPLETED" && { completedAt: new Date() }),
      },
    });
    return count === 1;
  });

  if (wonRace) {
    auditService.recordSystem({
      action: `PAYMENT_${nextStatus}`,
      entityType: "Payment",
      entityId: payment.id,
      metadata: { externalId, providerReference, amount: Number(payment.amount), failureReason },
    });

    if (nextStatus === "COMPLETED" && payment.subscription) {
      await activateSubscription(payment.subscription);
      // A newly active plan makes the store's published listings visible again.
      await require("./advertisement.service").invalidateListingCache();
      void eventNotifications.subscriptionActivated(payment.subscription);
      auditService.recordSystem({
        action: "SUBSCRIPTION_ACTIVATED",
        entityType: "Subscription",
        entityId: payment.subscription.id,
        metadata: { storeId: payment.subscription.storeId, planId: payment.subscription.planId },
      });
    }
    if (nextStatus === "COMPLETED" && payment.order) {
      await moveOrderToEscrow(payment.order, payment.amount);
      void eventNotifications.orderPaid(payment.order.id);
      auditService.recordSystem({
        action: "ESCROW_HELD",
        entityType: "Order",
        entityId: payment.order.id,
        metadata: { amount: Number(payment.amount) },
      });
    }
  }

  return prisma.payment.findUnique({ where: { id: payment.id } });
}

/** Buyer's payment is confirmed — the order becomes PAID and the amount is held in escrow. */
async function moveOrderToEscrow(order, amount) {
  await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { status: "PAID" } }),
    prisma.escrowTransaction.create({ data: { orderId: order.id, amount, status: "HELD" } }),
  ]);
}

async function activateSubscription(subscription) {
  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + subscription.plan.durationDays * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    // Only one subscription should be ACTIVE per store at a time.
    prisma.subscription.updateMany({
      where: { storeId: subscription.storeId, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    }),
    prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "ACTIVE", startsAt, expiresAt, adsUsed: 0 },
    }),
  ]);
}

async function listAll({ page = 1, pageSize = 20, status } = {}) {
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        order: { select: { id: true, buyerId: true, status: true, buyer: { select: { email: true } }, advertisement: { select: { title: true } } } },
        subscription: { select: { id: true, storeId: true, planId: true, status: true, plan: { select: { name: true } }, store: { select: { name: true, slug: true } } } },
      },
    }),
    prisma.payment.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

module.exports = { applyStatusUpdate, mapStatus, listAll };
