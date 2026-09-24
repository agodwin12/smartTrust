const prisma = require("../config/prisma");
const kpayService = require("../services/kpay.service");
const paymentService = require("../services/payment.service");

const STALE_AFTER_MS = 30 * 60 * 1000; // a USSD prompt is answered within minutes or never
const expiryHours = () => Number(process.env.PAYMENT_EXPIRY_HOURS || "2");
const BATCH = 25;

/**
 * Payments left PENDING/PROCESSING: first ask K-Pay for the truth (a webhook may have
 * been missed); anything still unconfirmed after PAYMENT_EXPIRY_HOURS is cancelled so
 * the order / subscription checkout stops being "in progress" forever. Everything goes
 * through payment.service.applyStatusUpdate, so a late COMPLETED still activates
 * whatever it paid for, exactly like a webhook would.
 */
module.exports = {
  name: "stale-payments",
  description: "Re-checks unconfirmed Mobile Money payments and expires abandoned ones",
  intervalMs: 10 * 60 * 1000,
  async run({ log }) {
    const now = Date.now();
    const stale = await prisma.payment.findMany({
      where: { status: { in: ["PENDING", "PROCESSING"] }, createdAt: { lt: new Date(now - STALE_AFTER_MS) } },
      orderBy: { createdAt: "asc" },
      take: BATCH,
      include: { subscription: { select: { id: true, status: true } } },
    });

    let refreshed = 0;
    let expired = 0;
    let cancelledSubscriptions = 0;
    for (const payment of stale) {
      let current = payment;
      if (payment.providerPaymentId) {
        try {
          const live = await kpayService.getPaymentStatus(payment.providerPaymentId);
          current = await paymentService.applyStatusUpdate({
            externalId: payment.externalId,
            providerPaymentId: live.id,
            providerReference: live.reference,
            status: live.status,
            failureReason: live.failureReason,
          });
          refreshed += 1;
        } catch (err) {
          log.warn({ paymentId: payment.id, err: err.message }, "could not refresh payment status");
        }
      }

      const abandoned = now - payment.createdAt.getTime() > expiryHours() * 60 * 60 * 1000;
      if (abandoned && ["PENDING", "PROCESSING"].includes(current.status)) {
        current = await paymentService.applyStatusUpdate({
          externalId: payment.externalId,
          status: "CANCELLED",
          failureReason: `Expired: no confirmation from the payment provider within ${expiryHours()}h`,
        });
        expired += 1;
      }

      // A subscription checkout whose payment died stays PENDING_PAYMENT otherwise and
      // keeps blocking the seller's next attempt with "payment in progress".
      if (payment.subscription?.status === "PENDING_PAYMENT" && ["FAILED", "CANCELLED"].includes(current.status)) {
        const { count } = await prisma.subscription.updateMany({ where: { id: payment.subscription.id, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } });
        cancelledSubscriptions += count;
      }
    }

    return { checked: stale.length, refreshed, expired, cancelledSubscriptions };
  },
};
