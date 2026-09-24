const kpayService = require("../services/kpay.service");
const paymentService = require("../services/payment.service");
const withdrawalService = require("../services/withdrawal.service");
const refundService = require("../services/refund.service");

async function kpayWebhook(req, res) {
  const signature = req.get("X-KPAY-Signature");
  const valid = req.rawBody && kpayService.verifyWebhookSignature(req.rawBody, signature);

  if (!valid) {
    // 401, not 400 — never hint at what a valid signature would look like.
    return res.status(401).json({ error: "Invalid webhook signature." });
  }

  // Deposit events (payment.*) carry `paymentId`, payout events (payout.*) carry
  // `payoutId` — the docs don't pin down the payout field name precisely, so
  // rather than branch on `event`, this just tries both event families against
  // their respective table by `externalId` (always present either way) and lets
  // whichever one actually finds a match win. Both handlers already no-op safely
  // when nothing matches.
  const { paymentId, payoutId, reference, externalId, status, failureReason } = req.body;
  const providerId = paymentId || payoutId;

  const paymentUpdated = await paymentService.applyStatusUpdate({
    externalId,
    providerPaymentId: providerId,
    providerReference: reference,
    status,
    failureReason,
  });

  if (!paymentUpdated) {
    const payoutEvent = { externalId, providerPayoutId: providerId, providerReference: reference, status, failureReason };
    // Payouts are either a seller withdrawal ("wd-…") or a buyer refund ("rf-…").
    const withdrawalUpdated = await withdrawalService.applyStatusUpdate(payoutEvent);
    if (!withdrawalUpdated) await refundService.applyStatusUpdate(payoutEvent);
  }

  // K-Pay retries on anything but a 2xx — always ack once the signature checks out,
  // even if externalId matched nothing at all (e.g. a stale/replayed event).
  res.status(200).json({ received: true });
}

async function listAll(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
  const result = await paymentService.listAll({ page, pageSize, status: req.query.status });
  res.json(result);
}

module.exports = { kpayWebhook, listAll };
