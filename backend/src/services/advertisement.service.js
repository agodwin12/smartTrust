const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { uniqueSlug } = require("../utils/slugify");
const { uploadImage, deleteImageByUrl } = require("./storage.service");
const cacheService = require("./cache.service");
const redis = require("../config/redis");
const { OPERATIONS } = require("../utils/roles");

const HERO_MIN_HOURS = 48;
const HERO_CACHE_PREFIX = "hero:";
// Public listing pages: the hottest read in the app (every browse/search/category page).
// Short TTL so a fresh publish/price change shows up within a minute; every write path
// below busts it explicitly as well.
const LIST_CACHE_PREFIX = "ads:list:";
const LIST_CACHE_TTL_SECONDS = 45;
// Detail-page view counters are batched in Redis (HINCRBY) and flushed to Postgres by the
// view-counts job — one DB write per listing per minute instead of one per page view.
const VIEWS_HASH = "ads:views";
// Short TTL, not zero — a hero feed viewed by hundreds of concurrent visitors at
// once collapses to one query per 20 seconds instead of one per request, while
// still feeling live. feature()/unfeature() also bust it immediately below, so an
// admin or seller action is never stuck waiting out the TTL to show up.
const HERO_CACHE_TTL_SECONDS = 20;

async function assertCategoryExists(categoryId) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new ApiError(422, "categoryId does not match an existing category.", "CATEGORY_NOT_FOUND");
}

async function uploadImages(files = []) {
  const urls = [];
  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop -- uploads must stay attributable/ordered per file
    urls.push(await uploadImage(file, "advertisements"));
  }
  return urls;
}

async function create(storeId, data, files) {
  await assertCategoryExists(data.categoryId);

  const slug = await uniqueSlug(
    data.title,
    (candidate) => prisma.advertisement.findUnique({ where: { slug: candidate } }).then(Boolean)
  );

  const images = files?.length ? await uploadImages(files) : undefined;

  return prisma.advertisement.create({
    data: { ...data, storeId, slug, images, status: "DRAFT" },
  });
}

async function findOwned(id, storeId) {
  const ad = await prisma.advertisement.findUnique({ where: { id } });
  if (!ad) throw new ApiError(404, "Advertisement not found.", "ADVERTISEMENT_NOT_FOUND");
  if (ad.storeId !== storeId) throw new ApiError(403, "This advertisement does not belong to you.", "FORBIDDEN");
  return ad;
}

async function getOwned(id, storeId) {
  const ad = await prisma.advertisement.findUnique({ where: { id }, include: { category: true } });
  if (!ad) throw new ApiError(404, "Advertisement not found.", "ADVERTISEMENT_NOT_FOUND");
  if (ad.storeId !== storeId) throw new ApiError(403, "This advertisement does not belong to you.", "FORBIDDEN");
  return ad;
}

async function update(id, storeId, data, files) {
  const ad = await findOwned(id, storeId);
  if (data.categoryId) await assertCategoryExists(data.categoryId);

  // While a flash-campaign price is applied, the price fields belong to the campaign.
  if (data.price !== undefined || data.compareAtPrice !== undefined) {
    const inFlash = await prisma.flashCampaignItem.count({ where: { advertisementId: id, applied: true } });
    if (inFlash) throw new ApiError(409, "This listing is in a live flash campaign; its price is locked until the campaign ends.", "FLASH_PRICE_LOCKED");
  }

  let images;
  if (files?.length) {
    images = await uploadImages(files);
    // Best-effort cleanup of the old set — never blocks the update if one fails.
    await Promise.all((ad.images || []).map((url) => deleteImageByUrl(url)));
  }

  return prisma.advertisement.update({
    where: { id },
    data: { ...data, ...(images && { images }) },
  });
}

async function publish(id, storeId) {
  const ad = await findOwned(id, storeId);
  if (ad.status === "PUBLISHED") return ad;

  const subscription = await prisma.subscription.findFirst({
    where: { storeId, status: "ACTIVE", expiresAt: { gt: new Date() } },
    include: { plan: true },
  });

  if (!subscription) {
    throw new ApiError(403, "You need an active subscription to publish an advertisement.", "NO_ACTIVE_SUBSCRIPTION");
  }

  // Same check-then-act race as escrow/withdrawals, fixed the same way: reading
  // adsUsed and then incrementing lets two concurrent publishes both see "49 of
  // 50" and both go through. The quota check IS the increment — the conditional
  // UPDATE only matches while adsUsed is still under the cap, so only one of two
  // racing publishes can ever take the last slot.
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.subscription.updateMany({
      where: { id: subscription.id, adsUsed: { lt: subscription.plan.adQuota } },
      data: { adsUsed: { increment: 1 } },
    });

    if (count === 0) {
      throw new ApiError(
        422,
        `Your ${subscription.plan.name} plan allows ${subscription.plan.adQuota} published ads. Renew or upgrade to publish more.`,
        "AD_QUOTA_REACHED"
      );
    }

    return tx.advertisement.update({ where: { id }, data: { status: "PUBLISHED" } });
  });
}

async function archive(id, storeId, isAdmin) {
  const ad = isAdmin
    ? await prisma.advertisement.findUnique({ where: { id } })
    : await findOwned(id, storeId);
  if (!ad) throw new ApiError(404, "Advertisement not found.", "ADVERTISEMENT_NOT_FOUND");
  if (ad.status === "ARCHIVED") return ad;

  const wasPublished = ad.status === "PUBLISHED";

  const ops = [prisma.advertisement.update({ where: { id }, data: { status: "ARCHIVED" } })];

  if (wasPublished) {
    // Frees up a quota slot — archiving is how a seller makes room for a new listing.
    const subscription = await prisma.subscription.findFirst({
      where: { storeId: ad.storeId, status: "ACTIVE" },
    });
    if (subscription) {
      // Conditional so a concurrent archive can't drive the counter negative.
      ops.unshift(
        prisma.subscription.updateMany({
          where: { id: subscription.id, adsUsed: { gt: 0 } },
          data: { adsUsed: { decrement: 1 } },
        })
      );
    }
  }

  const results = await prisma.$transaction(ops);
  return results[results.length - 1];
}

/** A listing is publicly visible when published AND its store's subscription hasn't lapsed. */
function visibilityFilter() {
  return {
    status: "PUBLISHED",
    store: {
      // A suspended store's listings must vanish from the marketplace immediately.
      status: "ACTIVE",
      subscriptions: { some: { status: "ACTIVE", expiresAt: { gt: new Date() } } },
    },
  };
}

/** Busts every cached public listing page (and the hero rail). Call after any write that changes what buyers can see. */
async function invalidateListingCache() {
  await Promise.all([cacheService.invalidatePrefix(LIST_CACHE_PREFIX), cacheService.invalidatePrefix(HERO_CACHE_PREFIX)]);
}

const SORT_ORDER = {
  newest: { createdAt: "desc" },
  price_asc: { price: "asc" },
  price_desc: { price: "desc" },
  popular: { viewCount: "desc" },
};

async function list({
  page = 1,
  pageSize = 20,
  categoryId,
  categorySlug,
  storeId,
  search,
  sort = "newest",
  minPrice,
  maxPrice,
  condition,
  location,
  deals = false,
} = {}) {
  // A category page shows its own listings AND its sub-categories' listings.
  let categoryIds;
  if (categorySlug || categoryId) {
    const root = categorySlug
      ? await prisma.category.findUnique({ where: { slug: categorySlug }, select: { id: true } })
      : { id: categoryId };
    if (!root) return { items: [], total: 0, page, pageSize };
    const children = await prisma.category.findMany({ where: { parentId: root.id }, select: { id: true } });
    categoryIds = [root.id, ...children.map((c) => c.id)];
  }

  const where = {
    ...visibilityFilter(),
    ...(categoryIds && { categoryId: { in: categoryIds } }),
    ...(storeId && { storeId }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...((minPrice !== undefined || maxPrice !== undefined) && {
      price: { ...(minPrice !== undefined && { gte: minPrice }), ...(maxPrice !== undefined && { lte: maxPrice }) },
    }),
    ...(["NEW", "USED"].includes(condition) && { condition }),
    ...(location && { location: { contains: location, mode: "insensitive" } }),
    // A "deal" is any listing whose seller set a higher compare-at price (validated > price on write).
    ...(deals && { compareAtPrice: { not: null } }),
  };

  const cacheKey = `${LIST_CACHE_PREFIX}${JSON.stringify({ page, pageSize, categoryIds, storeId, search, sort, minPrice, maxPrice, condition, location, deals })}`;
  return cacheService.getOrSet(cacheKey, LIST_CACHE_TTL_SECONDS, async () => {
    const [items, total] = await Promise.all([
      prisma.advertisement.findMany({
        where,
        orderBy: SORT_ORDER[sort] ?? SORT_ORDER.newest,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { store: { select: { id: true, name: true, slug: true, acceptsCashOnDelivery: true } }, category: true },
      }),
      prisma.advertisement.count({ where }),
    ]);

    return { items, total, page, pageSize };
  });
}

async function getBySlug(slug) {
  const ad = await prisma.advertisement.findFirst({
    where: { slug, ...visibilityFilter() },
    include: { store: { select: { id: true, name: true, slug: true, acceptsCashOnDelivery: true } }, category: true },
  });
  if (!ad) throw new ApiError(404, "Advertisement not found.", "ADVERTISEMENT_NOT_FOUND");

  // Count the view without a synchronous DB write; the job flushes the hash every minute.
  let pending = 0;
  try {
    pending = await redis.hincrby(VIEWS_HASH, ad.id, 1);
  } catch {
    const { viewCount } = await prisma.advertisement.update({ where: { id: ad.id }, data: { viewCount: { increment: 1 } }, select: { viewCount: true } });
    return { ...ad, viewCount };
  }
  return { ...ad, viewCount: ad.viewCount + pending };
}

/** Moves the batched view counters from Redis into Postgres. Returns how many listings were updated. */
async function flushViewCounts() {
  let counts;
  try {
    const raw = await redis.hgetall(VIEWS_HASH);
    if (!raw || Object.keys(raw).length === 0) return 0;
    await redis.del(VIEWS_HASH);
    counts = raw;
  } catch {
    return 0;
  }
  const entries = Object.entries(counts);
  await prisma.$transaction(entries.map(([id, n]) => prisma.advertisement.updateMany({ where: { id }, data: { viewCount: { increment: Number(n) } } })));
  return entries.length;
}

/** Staff view: every listing regardless of status / subscription. */
async function listAll({ page = 1, pageSize = 20, status, search, storeId } = {}) {
  const where = {
    ...(status && { status }),
    ...(storeId && { storeId }),
    ...(search && { title: { contains: search, mode: "insensitive" } }),
  };
  const [items, total] = await Promise.all([
    prisma.advertisement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { store: { select: { id: true, name: true, slug: true, acceptsCashOnDelivery: true } }, category: true },
    }),
    prisma.advertisement.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

async function listMine(storeId, { page = 1, pageSize = 20, status } = {}) {
  const where = { storeId, ...(status && { status }) };

  const [items, total] = await Promise.all([
    prisma.advertisement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { category: true },
    }),
    prisma.advertisement.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

async function feature(id, requester, durationHoursOverride) {
  const ad = await prisma.advertisement.findUnique({ where: { id }, include: { store: true } });
  if (!ad) throw new ApiError(404, "Advertisement not found.", "ADVERTISEMENT_NOT_FOUND");

  const isAdmin = OPERATIONS.includes(requester.role);
  let durationHours;

  if (isAdmin) {
    durationHours = durationHoursOverride || HERO_MIN_HOURS;
  } else {
    if (ad.store.ownerId !== requester.id) {
      throw new ApiError(403, "This advertisement does not belong to you.", "FORBIDDEN");
    }
    if (ad.status !== "PUBLISHED") {
      throw new ApiError(422, "Only a published advertisement can be featured.", "ADVERTISEMENT_NOT_PUBLISHED");
    }

    const subscription = await prisma.subscription.findFirst({
      where: { storeId: ad.storeId, status: "ACTIVE", expiresAt: { gt: new Date() } },
      include: { plan: true },
    });

    if (!subscription || !subscription.plan.heroEligible) {
      throw new ApiError(
        403,
        "Your current plan does not include hero placement. Upgrade to a plan with hero access.",
        "PLAN_NOT_HERO_ELIGIBLE"
      );
    }

    durationHours = subscription.plan.heroDurationHours;
  }

  const featuredAt = new Date();
  const featuredUntil = new Date(featuredAt.getTime() + durationHours * 60 * 60 * 1000);

  const updated = await prisma.advertisement.update({
    where: { id },
    data: { featuredAt, featuredUntil, featuredById: requester.id },
  });
  await cacheService.invalidatePrefix(HERO_CACHE_PREFIX);
  return updated;
}

async function unfeature(id, requester) {
  const ad = await prisma.advertisement.findUnique({ where: { id }, include: { store: true } });
  if (!ad) throw new ApiError(404, "Advertisement not found.", "ADVERTISEMENT_NOT_FOUND");

  const isAdmin = OPERATIONS.includes(requester.role);
  if (!isAdmin && ad.store.ownerId !== requester.id) {
    throw new ApiError(403, "This advertisement does not belong to you.", "FORBIDDEN");
  }

  const updated = await prisma.advertisement.update({ where: { id }, data: { featuredUntil: new Date() } });
  await cacheService.invalidatePrefix(HERO_CACHE_PREFIX);
  return updated;
}

/** Hero section feed — omit categoryId for the homepage hero, pass it for a category's own hero. */
async function listHero({ categoryId, limit = 12 } = {}) {
  const cacheKey = `${HERO_CACHE_PREFIX}${categoryId ?? "all"}:${limit}`;

  return cacheService.getOrSet(cacheKey, HERO_CACHE_TTL_SECONDS, () =>
    prisma.advertisement.findMany({
      where: {
        featuredUntil: { gt: new Date() },
        ...visibilityFilter(),
        ...(categoryId && { categoryId }),
      },
      orderBy: { featuredAt: "desc" },
      take: limit,
      include: { store: { select: { id: true, name: true, slug: true, acceptsCashOnDelivery: true } }, category: true },
    })
  );
}

module.exports = {
  invalidateListingCache,
  flushViewCounts,
  listAll,
  getOwned,
  create,
  update,
  publish,
  archive,
  list,
  getBySlug,
  listMine,
  feature,
  unfeature,
  listHero,
  visibilityFilter,
};
