const prisma = require("../config/prisma");
const kpayService = require("../services/kpay.service");
const withdrawalService = require("../services/withdrawal.service");
const refundService = require("../services/refund.service");

const MIN_AGE_MS = 2 * 60 * 1000; // give the webhook a chance first
const BATCH = 25;

/**
 * Seller withdrawals and buyer refunds still PENDING/PROCESSING: poll K-Pay so a missed
 * webhook cannot leave money "in flight" forever. Both apply functions are race-safe
 * against a webhook landing at the same moment.
 */
module.exports = {
  name: "payout-status",
  description: "Polls K-Pay for withdrawals and refunds still in flight",
  intervalMs: 5 * 60 * 1000,
  async run({ log }) {
    const before = new Date(Date.now() - MIN_AGE_MS);
    const where = { status: { in: ["PENDING", "PROCESSING"] }, providerPayoutId: { not: null }, createdAt: { lt: before } };

    const [withdrawals, refunds] = await Promise.all([
      prisma.withdrawal.findMany({ where, orderBy: { createdAt: "asc" }, take: BATCH }),
      prisma.refund.findMany({ where: { ...where, updatedAt: { lt: before } }, orderBy: { createdAt: "asc" }, take: BATCH }),
    ]);

    const summary = { withdrawalsChecked: withdrawals.length, refundsChecked: refunds.length, settled: 0, errors: 0 };

    for (const w of withdrawals) {
      try {
        const live = await kpayService.getWithdrawalStatus(w.providerPayoutId);
        const updated = await withdrawalService.applyStatusUpdate({ externalId: w.externalId, providerPayoutId: live.id, providerReference: live.reference, status: live.status, failureReason: live.failureReason });
        if (updated && updated.status !== w.status) summary.settled += 1;
      } catch (err) {
        summary.errors += 1;
        log.warn({ withdrawalId: w.id, err: err.message }, "could not refresh withdrawal");
      }
    }

    for (const r of refunds) {
      try {
        const updated = await refundService.refreshStatus(r.id);
        if (updated && updated.status !== r.status) summary.settled += 1;
      } catch (err) {
        summary.errors += 1;
        log.warn({ refundId: r.id, err: err.message }, "could not refresh refund");
      }
    }

    return summary;
  },
};
