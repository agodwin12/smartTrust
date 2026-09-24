const prisma = require("../config/prisma");
const auditService = require("../services/audit.service");
const eventNotifications = require("../services/eventNotifications");
const advertisementService = require("../services/advertisement.service");

const DAY_MS = 24 * 60 * 60 * 1000;
const NOTICE_DAYS = 3;

const include = { plan: { select: { name: true } }, store: { select: { id: true, ownerId: true, slug: true } } };

/**
 * 1. ACTIVE subscriptions past `expiresAt` become EXPIRED. The seller is told, and if the
 *    store has no other active plan, how many published listings just disappeared from
 *    the marketplace (visibilityFilter only shows stores with an active plan).
 * 2. Subscriptions expiring within 3 days get one "renew soon" notice (flagged on the row).
 */
module.exports = {
  name: "subscription-expiry",
  description: "Expires overdue subscriptions and sends renewal notices",
  intervalMs: 15 * 60 * 1000,
  async run({ log }) {
    const now = new Date();

    const overdue = await prisma.subscription.findMany({ where: { status: "ACTIVE", expiresAt: { lte: now } }, include, take: 500 });
    let expired = 0;
    for (const sub of overdue) {
      const { count } = await prisma.subscription.updateMany({ where: { id: sub.id, status: "ACTIVE" }, data: { status: "EXPIRED" } });
      if (count === 0) continue;
      expired += 1;
      const stillCovered = await prisma.subscription.count({ where: { storeId: sub.storeId, status: "ACTIVE", expiresAt: { gt: now } } });
      const hiddenListings = stillCovered > 0 ? 0 : await prisma.advertisement.count({ where: { storeId: sub.storeId, status: "PUBLISHED" } });
      await eventNotifications.subscriptionExpired(sub, hiddenListings);
      auditService.recordSystem({ action: "SUBSCRIPTION_EXPIRED", entityType: "Subscription", entityId: sub.id, metadata: { storeId: sub.storeId, planName: sub.plan?.name, hiddenListings } });
      log.info({ subscriptionId: sub.id, storeId: sub.storeId, hiddenListings }, "subscription expired");
    }

    if (expired > 0) await advertisementService.invalidateListingCache();

    const soon = new Date(now.getTime() + NOTICE_DAYS * DAY_MS);
    const upcoming = await prisma.subscription.findMany({
      where: { status: "ACTIVE", expiresAt: { gt: now, lte: soon }, expiryNoticeSentAt: null },
      include,
      take: 500,
    });
    let notices = 0;
    for (const sub of upcoming) {
      const { count } = await prisma.subscription.updateMany({ where: { id: sub.id, expiryNoticeSentAt: null }, data: { expiryNoticeSentAt: now } });
      if (count === 0) continue;
      notices += 1;
      const daysLeft = Math.max(1, Math.ceil((sub.expiresAt.getTime() - now.getTime()) / DAY_MS));
      await eventNotifications.subscriptionExpiring(sub, daysLeft);
    }

    return { expired, renewalNotices: notices };
  },
};
