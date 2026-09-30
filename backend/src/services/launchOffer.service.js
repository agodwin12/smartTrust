const prisma = require("../config/prisma");
const logger = require("../config/logger");

/**
 * Launch offer: for the first months after going live, selling on SmartPlaze is free.
 *
 * Every approved store without a plan gets a free "Launch offer" subscription that ends when
 * the offer ends (LAUNCH_OFFER_ENDS_AT, default 31 March 2027 23:59 Douala time). It is an
 * ordinary ACTIVE subscription, so publishing, quotas and marketplace visibility work exactly
 * as with a paid plan, and when it expires the usual expiry job hides the listings until the
 * seller picks a paid plan. The plan itself is hidden from the public pricing and can't be bought;
 * staff can still change its listing quota from the admin plans screen.
 */
const DEFAULT_ENDS_AT = "2027-03-31T22:59:59.000Z";
const PLAN_DEFAULTS = { name: "Launch offer", durationDays: 183, adQuota: 300, price: 0, isActive: false, heroEligible: false, heroDurationHours: null };

function endsAt() {
  const configured = new Date(process.env.LAUNCH_OFFER_ENDS_AT || DEFAULT_ENDS_AT);
  return Number.isNaN(configured.getTime()) ? new Date(DEFAULT_ENDS_AT) : configured;
}

const isOpen = (now = new Date()) => now < endsAt();

/** What the pricing pages show: whether the offer runs and until when. */
const info = (now = new Date()) => ({ open: isOpen(now), endsAt: endsAt().toISOString() });

/** The hidden launch plan, created on first use. */
async function getPlan() {
  const existing = await prisma.subscriptionPlan.findFirst({ where: { isLaunchOffer: true } });
  if (existing) return existing;
  return prisma.subscriptionPlan.upsert({
    where: { name: PLAN_DEFAULTS.name },
    update: { isLaunchOffer: true, isActive: false },
    create: { ...PLAN_DEFAULTS, isLaunchOffer: true },
  });
}

/**
 * Gives an approved store with no active plan the free launch plan, while the offer runs.
 * Listings the store already had published count against the quota. Returns the new
 * subscription, or null when nothing was granted.
 */
async function grant(storeId, now = new Date()) {
  if (!isOpen(now)) return null;
  const plan = await getPlan();

  const subscription = await prisma.$transaction(async (tx) => {
    // Row lock on the store: the approval and the background job can't both grant it.
    const [store] = await tx.$queryRaw`SELECT status FROM stores WHERE id = ${storeId} FOR UPDATE`;
    if (store?.status !== "ACTIVE") return null;
    const covered = await tx.subscription.count({ where: { storeId, status: "ACTIVE", expiresAt: { gt: now } } });
    if (covered > 0) return null;
    const published = await tx.advertisement.count({ where: { storeId, status: "PUBLISHED" } });
    return tx.subscription.create({
      data: { storeId, planId: plan.id, status: "ACTIVE", startsAt: now, expiresAt: endsAt(), adsUsed: published },
      include: { plan: true },
    });
  });
  if (!subscription) return null;

  require("./audit.service").recordSystem({
    action: "LAUNCH_OFFER_GRANTED",
    entityType: "Subscription",
    entityId: subscription.id,
    metadata: { storeId, expiresAt: subscription.expiresAt },
  });
  void require("./eventNotifications").subscriptionActivated(subscription);
  if (subscription.adsUsed > 0) await require("./advertisement.service").invalidateListingCache().catch(() => {});
  logger.info({ storeId, subscriptionId: subscription.id }, "launch offer granted");
  return subscription;
}

/**
 * Background pass (subscription-expiry job): keeps running launch plans aligned with the
 * configured end date (so moving LAUNCH_OFFER_ENDS_AT applies to everyone), and, while the
 * offer runs, grants it to approved stores left without a plan. Returns how many were granted.
 */
async function sweep(now = new Date()) {
  const end = endsAt();
  const { count: realigned } = await prisma.subscription.updateMany({
    where: { status: "ACTIVE", plan: { isLaunchOffer: true }, expiresAt: { gt: now, not: end } },
    data: { expiresAt: end, expiryNoticeSentAt: null },
  });
  if (!isOpen(now)) return { granted: 0, realigned };

  const uncovered = await prisma.store.findMany({
    where: { status: "ACTIVE", subscriptions: { none: { status: "ACTIVE", expiresAt: { gt: now } } } },
    select: { id: true },
    take: 500,
  });
  let granted = 0;
  for (const { id } of uncovered) if (await grant(id, now)) granted += 1;
  return { granted, realigned };
}

module.exports = { endsAt, isOpen, info, getPlan, grant, sweep };
