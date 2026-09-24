const prisma = require("../config/prisma");

const byStatus = (rows) => Object.fromEntries(rows.map((r) => [r.status, r._count._all]));

/** Back-office overview in one round-trip: counts by status + money currently in escrow / pending payout. */
async function stats() {
  const now = new Date();
  const [users, staff, stores, listings, orders, escrow, disputesOpen, withdrawals, sales, contactsUnhandled, subscriptionsActive] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: { not: "CUSTOMER" } } }),
      prisma.store.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.advertisement.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.escrowTransaction.aggregate({ where: { status: "HELD" }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.dispute.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
      prisma.withdrawal.aggregate({ where: { status: { in: ["PENDING", "PROCESSING"] } }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.order.aggregate({ where: { status: "COMPLETED" }, _sum: { totalAmount: true }, _count: { _all: true } }),
      prisma.contactMessage.count({ where: { handledAt: null } }),
      prisma.subscription.count({ where: { status: "ACTIVE", expiresAt: { gt: now } } }),
    ]);

  return {
    users: { total: users, staff },
    stores: byStatus(stores),
    listings: byStatus(listings),
    orders: byStatus(orders),
    escrow: { held: Number(escrow._sum.amount ?? 0), count: escrow._count._all },
    disputesOpen,
    withdrawalsPending: { amount: Number(withdrawals._sum.amount ?? 0), count: withdrawals._count._all },
    sales: { amount: Number(sales._sum.totalAmount ?? 0), count: sales._count._all },
    contactsUnhandled,
    subscriptionsActive,
  };
}

module.exports = { stats };
