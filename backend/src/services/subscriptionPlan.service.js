const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const cacheService = require("./cache.service");

const CACHE_PREFIX = "plans:";
// Longer TTL than categories — pricing tiers change even less often than the
// category tree, and this endpoint gets hit on every pricing/upgrade screen.
const CACHE_TTL_SECONDS = 300;

// Not page-based like the other list endpoints — plans are admin-curated platform
// configuration (pricing tiers), not user-generated content, so there's no realistic
// scenario with more than a handful. A hard cap is still here as a safety net against
// an unbounded query, without paginating something that's meant to render as a whole
// pricing table in one shot.
async function listPlans({ includeInactive = false } = {}) {
  const cacheKey = `${CACHE_PREFIX}list:${includeInactive}`;

  return cacheService.getOrSet(cacheKey, CACHE_TTL_SECONDS, () =>
    prisma.subscriptionPlan.findMany({
      // The free launch plan is granted automatically, never shown on the public pricing.
      where: includeInactive ? {} : { isActive: true, isLaunchOffer: false },
      orderBy: { price: "asc" },
      take: 100,
      // Staff view: how many subscriptions ever used each plan (drives the "deactivate instead of delete" hint).
      ...(includeInactive && { include: { _count: { select: { subscriptions: true } } } }),
    })
  );
}

async function createPlan(data) {
  const existing = await prisma.subscriptionPlan.findUnique({ where: { name: data.name } });
  if (existing) throw new ApiError(409, "A plan with this name already exists.", "PLAN_NAME_TAKEN");
  const plan = await prisma.subscriptionPlan.create({ data });
  await cacheService.invalidatePrefix(CACHE_PREFIX);
  return plan;
}

async function updatePlan(id, data) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
  if (!plan) throw new ApiError(404, "Plan not found.", "PLAN_NOT_FOUND");

  // The launch plan stays free, hidden and tied to the offer's end date: only its quota,
  // hero settings, name and bullet points can change.
  if (plan.isLaunchOffer) {
    data = Object.fromEntries(Object.entries(data).filter(([key]) => !["price", "durationDays", "isActive"].includes(key)));
  }

  const heroEligible = data.heroEligible ?? plan.heroEligible;
  const heroDurationHours = data.heroDurationHours ?? plan.heroDurationHours;
  if (heroEligible && !heroDurationHours) {
    throw new ApiError(422, "heroDurationHours is required when heroEligible is true.", "VALIDATION_ERROR");
  }

  const updated = await prisma.subscriptionPlan.update({ where: { id }, data });
  await cacheService.invalidatePrefix(CACHE_PREFIX);
  return updated;
}

async function deletePlan(id) {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id },
    include: { _count: { select: { subscriptions: true } } },
  });
  if (!plan) throw new ApiError(404, "Plan not found.", "PLAN_NOT_FOUND");
  if (plan._count.subscriptions > 0) {
    // Preserve history for existing subscribers — deactivate instead of deleting.
    throw new ApiError(
      409,
      "This plan has subscriptions attached. Deactivate it (isActive: false) instead of deleting.",
      "PLAN_IN_USE"
    );
  }
  await prisma.subscriptionPlan.delete({ where: { id } });
  await cacheService.invalidatePrefix(CACHE_PREFIX);
}

module.exports = { listPlans, createPlan, updatePlan, deletePlan };
