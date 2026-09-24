const auditService = require("../services/audit.service");

async function list(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 50, 1), 200);
  const from = req.query.from ? new Date(req.query.from) : undefined;
  const to = req.query.to ? new Date(req.query.to) : undefined;

  const result = await auditService.list({
    page,
    pageSize,
    actorId: req.query.actorId,
    action: req.query.action,
    entityType: req.query.entityType,
    entityId: req.query.entityId,
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
  });
  res.json(result);
}

module.exports = { list };
