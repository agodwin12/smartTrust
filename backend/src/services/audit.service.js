const prisma = require("../config/prisma");
const logger = require("../config/logger");

/**
 * Fire-and-forget: the write is NOT awaited, so it never adds a database round
 * trip to the response time of the request it's describing, and a failure to
 * write the log line never fails (or even slows) the action itself. The trade is
 * that a log line can, in theory, be lost if the process dies in the same
 * instant — acceptable for an activity trail, not acceptable for money, which is
 * why money never goes through here.
 */
function write(data) {
  prisma.auditLog.create({ data }).catch((err) => {
    logger.warn({ err: err.message, action: data.action }, "Audit log write failed");
  });
}

/** From a request — actor is whoever's authenticated (or nobody, e.g. a failed login). */
function record(req, { action, entityType, entityId, metadata, actorId, actorRole }) {
  write({
    actorId: actorId ?? req.user?.id ?? null,
    actorRole: actorRole ?? req.user?.role ?? null,
    action,
    entityType: entityType ?? null,
    entityId: entityId ?? null,
    metadata: metadata ?? undefined,
    ipAddress: req.ip ?? null,
    userAgent: req.get?.("user-agent") ?? null,
  });
}

/** For changes with no human behind them — a payment webhook activating a subscription, etc. */
function recordSystem({ action, entityType, entityId, metadata }) {
  write({
    actorId: null,
    actorRole: "SYSTEM",
    action,
    entityType: entityType ?? null,
    entityId: entityId ?? null,
    metadata: metadata ?? undefined,
  });
}

async function list({ page = 1, pageSize = 50, actorId, action, entityType, entityId, from, to } = {}) {
  const where = {
    ...(actorId && { actorId }),
    ...(action && { action }),
    ...(entityType && { entityType }),
    ...(entityId && { entityId }),
    ...((from || to) && { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { id: true, email: true, firstName: true, lastName: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

module.exports = { record, recordSystem, list };
