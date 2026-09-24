const refundService = require("../services/refund.service");
const audit = require("../services/audit.service");

async function list(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
  res.json(await refundService.listAll({ page, pageSize, status: req.query.status }));
}

async function getById(req, res) {
  res.json({ refund: await refundService.getById(req.params.id) });
}

async function retry(req, res) {
  const refund = await refundService.retry(req.params.id, { ...req.body, actorId: req.user.id });
  audit.record(req, {
    action: "REFUND_RETRIED",
    entityType: "Refund",
    entityId: refund.id,
    metadata: { orderId: refund.orderId, status: refund.status, operator: refund.operator, failureReason: refund.failureReason },
  });
  res.json({ refund });
}

async function refresh(req, res) {
  res.json({ refund: await refundService.refreshStatus(req.params.id) });
}

module.exports = { list, getById, retry, refresh };
