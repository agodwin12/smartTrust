const disputeService = require("../services/dispute.service");
const audit = require("../services/audit.service");

async function list(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
  const result = await disputeService.list({ page, pageSize, status: req.query.status });
  res.json(result);
}

async function getById(req, res) {
  const dispute = await disputeService.getById(req.params.id);
  res.json({ dispute });
}

async function update(req, res) {
  const dispute = await disputeService.updateStatus(req.params.id, req.body);
  audit.record(req, { action: "DISPUTE_UPDATED", entityType: "Dispute", entityId: dispute.id, metadata: req.body });
  res.json({ dispute });
}

async function releaseToSeller(req, res) {
  const dispute = await disputeService.releaseToSeller(req.params.id, req.body.resolution);
  audit.record(req, {
    action: "ESCROW_RELEASED",
    entityType: "Order",
    entityId: dispute.orderId,
    metadata: { via: "dispute", disputeId: dispute.id, resolution: req.body.resolution },
  });
  res.json({ dispute });
}

async function refundBuyer(req, res) {
  const dispute = await disputeService.refundBuyer(req.params.id, req.body.resolution, req.user.id);
  audit.record(req, {
    action: "ESCROW_REFUNDED",
    entityType: "Order",
    entityId: dispute.orderId,
    metadata: { via: "dispute", disputeId: dispute.id, resolution: req.body.resolution, refundId: dispute.refund?.id ?? null, refundStatus: dispute.refund?.status ?? null },
  });
  res.json({ dispute });
}

module.exports = { list, getById, update, releaseToSeller, refundBuyer };
