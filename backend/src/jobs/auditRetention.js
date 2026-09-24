const prisma = require("../config/prisma");

const DAY_MS = 24 * 60 * 60 * 1000;
const retentionDays = () => Math.max(30, Number(process.env.AUDIT_LOG_RETENTION_DAYS || "365"));

/**
 * Audit rows older than AUDIT_LOG_RETENTION_DAYS (default one year, never under 30 days)
 * are deleted in batches so the table does not grow without bound. Money-related history
 * lives on the orders/payments/refunds rows themselves and is untouched.
 */
module.exports = {
  name: "audit-retention",
  description: "Deletes audit-log rows older than the retention window",
  intervalMs: 24 * 60 * 60 * 1000,
  initialDelayMs: 60 * 1000,
  async run({ log }) {
    const cutoff = new Date(Date.now() - retentionDays() * DAY_MS);
    let deleted = 0;
    for (let round = 0; round < 50; round += 1) {
      const batch = await prisma.auditLog.findMany({ where: { createdAt: { lt: cutoff } }, select: { id: true }, take: 1000 });
      if (batch.length === 0) break;
      const { count } = await prisma.auditLog.deleteMany({ where: { id: { in: batch.map((row) => row.id) } } });
      deleted += count;
      if (batch.length < 1000) break;
    }
    if (deleted) log.info({ deleted, cutoff }, "audit rows pruned");
    return { deleted, retentionDays: retentionDays(), cutoff };
  },
};
