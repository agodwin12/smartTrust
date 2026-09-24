const prisma = require("../config/prisma");
const logger = require("../config/logger");
const ApiError = require("../utils/ApiError");
const { uniqueSlug } = require("../utils/slugify");
const cacheService = require("./cache.service");
const advertisementService = require("./advertisement.service");
const eventNotifications = require("./eventNotifications");

/*
 * Flash-deal campaigns, run by the back-office:
 *   admin creates a campaign (dates, minimum discount) and publishes it
 *   → sellers apply with a listing + campaign price (or admin adds listings directly)
 *   → admin approves/rejects
 *   → the job applies approved campaign prices when the campaign starts (the listing's
 *     price becomes the campaign price, its old price becomes the "was" price so the usual
 *     deal badge shows) and restores everything when it ends or is cancelled.
 * While a campaign price is applied, the seller cannot edit that listing's price.
 */

const CACHE_PREFIX = "flash:";
const CACHE_TTL_SECONDS = 20;

const adSelect = {
  id: true,
  title: true,
  slug: true,
  price: true,
  compareAtPrice: true,
  images: true,
  condition: true,
  status: true,
  store: { select: { id: true, name: true, slug: true, ownerId: true } },
  category: { select: { name: true, slug: true } },
};

const itemInclude = { advertisement: { select: adSelect } };

/** DRAFT / CANCELLED as stored; a PUBLISHED campaign is SCHEDULED, ACTIVE or ENDED by its dates. */
function phase(campaign, now = new Date()) {
  if (campaign.status !== "PUBLISHED") return campaign.status;
  if (now < campaign.startsAt) return "SCHEDULED";
  if (now < campaign.endsAt) return "ACTIVE";
  return "ENDED";
}

const discountPercent = (from, to) => Math.round((1 - Number(to) / Number(from)) * 100);

const decorateItem = (item) => ({
  ...item,
  discountPercent: item.applied && item.originalPrice ? discountPercent(item.originalPrice, item.campaignPrice) : discountPercent(item.advertisement.price, item.campaignPrice),
});

const decorate = (campaign, now = new Date()) =>
  campaign && { ...campaign, phase: phase(campaign, now), ...(campaign.items && { items: campaign.items.map(decorateItem) }) };

async function invalidate() {
  await Promise.all([cacheService.invalidatePrefix(CACHE_PREFIX), advertisementService.invalidateListingCache()]);
}

/* ----------------------------------------------------------------------------- price moves */

/** Puts the campaign price on the listing (inside a transaction). Returns false when it no longer applies. */
async function applyItem(tx, item) {
  const ad = await tx.advertisement.findUnique({ where: { id: item.advertisementId }, select: { price: true, compareAtPrice: true, status: true } });
  if (!ad || ad.status !== "PUBLISHED" || Number(item.campaignPrice) >= Number(ad.price)) return false;
  await tx.advertisement.update({ where: { id: item.advertisementId }, data: { price: item.campaignPrice, compareAtPrice: ad.price } });
  await tx.flashCampaignItem.update({
    where: { id: item.id },
    data: { applied: true, appliedAt: new Date(), originalPrice: ad.price, originalCompareAtPrice: ad.compareAtPrice },
  });
  return true;
}

/** Puts the seller's own prices back (inside a transaction). */
async function restoreItem(tx, item) {
  if (!item.applied) return;
  await tx.advertisement.update({ where: { id: item.advertisementId }, data: { price: item.originalPrice, compareAtPrice: item.originalCompareAtPrice } });
  await tx.flashCampaignItem.update({ where: { id: item.id }, data: { applied: false } });
}

const applyNow = (item) => prisma.$transaction((tx) => applyItem(tx, item));
const restoreNow = (item) => prisma.$transaction((tx) => restoreItem(tx, item));

/* ----------------------------------------------------------------------------- lookups */

async function requireCampaign(id, include) {
  const campaign = await prisma.flashCampaign.findUnique({ where: { id }, include });
  if (!campaign) throw new ApiError(404, "Flash campaign not found.", "FLASH_CAMPAIGN_NOT_FOUND");
  return campaign;
}

async function requireItem(campaignId, itemId) {
  const item = await prisma.flashCampaignItem.findFirst({ where: { id: itemId, campaignId }, include: itemInclude });
  if (!item) throw new ApiError(404, "Flash deal not found.", "FLASH_ITEM_NOT_FOUND");
  return item;
}

/* ----------------------------------------------------------------------------- public */

async function current() {
  return cacheService.getOrSet(`${CACHE_PREFIX}current`, CACHE_TTL_SECONDS, async () => {
    const now = new Date();
    const campaign = await prisma.flashCampaign.findFirst({
      where: { status: "PUBLISHED", startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { startsAt: "desc" },
      include: {
        items: {
          where: { status: "APPROVED", applied: true, advertisement: advertisementService.visibilityFilter() },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: itemInclude,
        },
      },
    });
    return decorate(campaign, now);
  });
}

async function upcoming() {
  return cacheService.getOrSet(`${CACHE_PREFIX}upcoming`, CACHE_TTL_SECONDS, async () => {
    const now = new Date();
    const campaign = await prisma.flashCampaign.findFirst({
      where: { status: "PUBLISHED", startsAt: { gt: now } },
      orderBy: { startsAt: "asc" },
      include: { _count: { select: { items: { where: { status: "APPROVED" } } } } },
    });
    return decorate(campaign, now);
  });
}

/* ----------------------------------------------------------------------------- sellers */

/** Campaigns a seller can still apply to, with that store's own applications attached. */
async function listOpen(storeId) {
  const now = new Date();
  const campaigns = await prisma.flashCampaign.findMany({
    where: { status: "PUBLISHED", applicationsOpen: true, endsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
    include: { items: { where: { storeId }, include: itemInclude, orderBy: { createdAt: "desc" } } },
  });
  return campaigns.map((c) => decorate(c, now));
}

async function listMine(storeId) {
  const now = new Date();
  const items = await prisma.flashCampaignItem.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    include: { ...itemInclude, campaign: true },
  });
  return items.map((item) => ({ ...decorateItem(item), campaign: decorate(item.campaign, now) }));
}

async function assertListingEligible(advertisementId, storeId) {
  const ad = await prisma.advertisement.findFirst({ where: { id: advertisementId, ...(storeId && { storeId }) }, select: { id: true, storeId: true, price: true, status: true } });
  if (!ad) throw new ApiError(404, "Listing not found.", "ADVERTISEMENT_NOT_FOUND");
  if (ad.status !== "PUBLISHED") throw new ApiError(422, "Only a published listing can join a flash campaign.", "ADVERTISEMENT_NOT_PUBLISHED");
  const busy = await prisma.flashCampaignItem.count({ where: { advertisementId, applied: true } });
  if (busy) throw new ApiError(409, "This listing is already running in a live flash campaign.", "FLASH_LISTING_BUSY");
  return ad;
}

function assertDiscount(campaign, basePrice, campaignPrice) {
  const pct = discountPercent(basePrice, campaignPrice);
  if (Number(campaignPrice) >= Number(basePrice) || pct < campaign.minDiscountPercent) {
    throw new ApiError(422, `The campaign price must be at least ${campaign.minDiscountPercent}% below the current price.`, "FLASH_DISCOUNT_TOO_SMALL");
  }
}

async function apply(campaignId, storeId, { advertisementId, campaignPrice, note }) {
  const campaign = await requireCampaign(campaignId);
  const now = new Date();
  if (campaign.status !== "PUBLISHED" || !campaign.applicationsOpen || campaign.endsAt <= now) {
    throw new ApiError(409, "This campaign is not accepting applications.", "FLASH_APPLICATIONS_CLOSED");
  }
  const ad = await assertListingEligible(advertisementId, storeId);
  assertDiscount(campaign, ad.price, campaignPrice);
  const existing = await prisma.flashCampaignItem.findUnique({ where: { campaignId_advertisementId: { campaignId, advertisementId } } });
  if (existing) throw new ApiError(409, "This listing has already been submitted to the campaign.", "FLASH_ALREADY_APPLIED");

  const item = await prisma.flashCampaignItem.create({
    data: { campaignId, advertisementId, storeId, campaignPrice, note: note ?? null, status: "PENDING" },
    include: itemInclude,
  });
  return decorateItem(item);
}

async function withdraw(campaignId, itemId, storeId) {
  const item = await requireItem(campaignId, itemId);
  if (item.storeId !== storeId) throw new ApiError(403, "This application is not yours.", "FORBIDDEN");
  if (item.status !== "PENDING") throw new ApiError(409, "Only a pending application can be withdrawn.", "FLASH_ITEM_NOT_PENDING");
  await prisma.flashCampaignItem.delete({ where: { id: item.id } });
}

/* ----------------------------------------------------------------------------- admin */

async function listAll({ page = 1, pageSize = 20, status } = {}) {
  const now = new Date();
  const where = status ? { status } : {};
  const [rows, total] = await Promise.all([
    prisma.flashCampaign.findMany({
      where,
      orderBy: { startsAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { items: true } } },
    }),
    prisma.flashCampaign.count({ where }),
  ]);
  const pending = rows.length
    ? await prisma.flashCampaignItem.groupBy({ by: ["campaignId"], where: { campaignId: { in: rows.map((r) => r.id) }, status: "PENDING" }, _count: { _all: true } })
    : [];
  const pendingById = new Map(pending.map((p) => [p.campaignId, p._count._all]));
  return {
    items: rows.map((c) => ({ ...decorate(c, now), itemCount: c._count.items, pendingCount: pendingById.get(c.id) ?? 0 })),
    total,
    page,
    pageSize,
  };
}

async function getAdmin(id) {
  const campaign = await requireCampaign(id, { items: { orderBy: [{ status: "asc" }, { createdAt: "desc" }], include: itemInclude } });
  return decorate(campaign);
}

function assertDates(startsAt, endsAt) {
  if (!(startsAt instanceof Date) || !(endsAt instanceof Date) || endsAt <= startsAt) {
    throw new ApiError(422, "The campaign must end after it starts.", "FLASH_DATES_INVALID");
  }
}

async function create(data, actorId) {
  assertDates(data.startsAt, data.endsAt);
  const slug = await uniqueSlug(data.name, (candidate) => prisma.flashCampaign.findUnique({ where: { slug: candidate } }).then(Boolean));
  const campaign = await prisma.flashCampaign.create({ data: { ...data, slug, createdById: actorId ?? null } });
  return decorate(campaign);
}

async function update(id, data) {
  const campaign = await requireCampaign(id);
  const next = { ...campaign, ...data };
  assertDates(next.startsAt, next.endsAt);
  if (campaign.status === "CANCELLED") throw new ApiError(409, "A cancelled campaign cannot be edited.", "FLASH_CAMPAIGN_CANCELLED");
  const updated = await prisma.flashCampaign.update({ where: { id }, data });
  await invalidate();
  return decorate(updated);
}

async function publish(id) {
  const campaign = await requireCampaign(id);
  if (campaign.status !== "DRAFT") throw new ApiError(409, "Only a draft campaign can be published.", "FLASH_CAMPAIGN_NOT_DRAFT");
  if (campaign.endsAt <= new Date()) throw new ApiError(422, "The campaign end date is already in the past.", "FLASH_DATES_INVALID");
  const updated = await prisma.flashCampaign.update({ where: { id }, data: { status: "PUBLISHED" } });
  await invalidate();
  return decorate(updated);
}

/** Cancels a campaign at any stage; applied campaign prices are restored immediately. */
async function cancel(id) {
  const campaign = await requireCampaign(id, { items: { where: { applied: true } } });
  if (campaign.status === "CANCELLED") return decorate(campaign);
  for (const item of campaign.items) await restoreNow(item);
  const updated = await prisma.flashCampaign.update({ where: { id }, data: { status: "CANCELLED", endedAt: campaign.endedAt ?? new Date() } });
  await invalidate();
  if (campaign.items.length) await eventNotifications.flashCampaignEnded(updated, await itemsWithOwners(id));
  return decorate(updated);
}

async function itemsWithOwners(campaignId) {
  return prisma.flashCampaignItem.findMany({ where: { campaignId, status: "APPROVED" }, include: itemInclude });
}

/** Admin adds a listing straight in as APPROVED (goes live at once if the campaign is running). */
async function addItem(campaignId, { advertisementId, campaignPrice }, actorId) {
  const campaign = await requireCampaign(campaignId);
  if (campaign.status === "CANCELLED" || campaign.endsAt <= new Date()) throw new ApiError(409, "This campaign is over.", "FLASH_CAMPAIGN_OVER");
  const ad = await assertListingEligible(advertisementId);
  assertDiscount(campaign, ad.price, campaignPrice);
  const existing = await prisma.flashCampaignItem.findUnique({ where: { campaignId_advertisementId: { campaignId, advertisementId } } });
  if (existing) throw new ApiError(409, "This listing is already in the campaign.", "FLASH_ALREADY_APPLIED");

  const item = await prisma.flashCampaignItem.create({
    data: { campaignId, advertisementId, storeId: ad.storeId, campaignPrice, status: "APPROVED", reviewedById: actorId ?? null, reviewedAt: new Date() },
    include: itemInclude,
  });
  if (phase(campaign) === "ACTIVE" && campaign.activatedAt) await applyNow(item);
  await invalidate();
  return decorateItem(await requireItem(campaignId, item.id));
}

/** Approve (optionally with a corrected price) or reject a seller's application. */
async function reviewItem(campaignId, itemId, { status, campaignPrice, reviewNote }, actorId) {
  const campaign = await requireCampaign(campaignId);
  const item = await requireItem(campaignId, itemId);
  if (campaign.status === "CANCELLED") throw new ApiError(409, "This campaign was cancelled.", "FLASH_CAMPAIGN_CANCELLED");

  const price = campaignPrice ?? item.campaignPrice;
  if (status === "APPROVED") {
    const basePrice = item.applied ? item.originalPrice : item.advertisement.price;
    assertDiscount(campaign, basePrice, price);
  }
  if (item.applied && (status === "REJECTED" || Number(price) !== Number(item.campaignPrice))) await restoreNow(item);

  const updated = await prisma.flashCampaignItem.update({
    where: { id: item.id },
    data: { status, campaignPrice: price, reviewNote: reviewNote ?? null, reviewedById: actorId ?? null, reviewedAt: new Date() },
    include: itemInclude,
  });
  if (status === "APPROVED" && phase(campaign) === "ACTIVE" && campaign.activatedAt) await applyNow(updated);
  await invalidate();
  if (status !== item.status || status === "REJECTED") await eventNotifications.flashApplicationReviewed(updated, campaign);
  return decorateItem(await requireItem(campaignId, item.id));
}

async function removeItem(campaignId, itemId) {
  const item = await requireItem(campaignId, itemId);
  if (item.applied) await restoreNow(item);
  await prisma.flashCampaignItem.delete({ where: { id: item.id } });
  await invalidate();
}

/* ----------------------------------------------------------------------------- job hooks */

/** Campaigns whose start time has passed get their approved prices applied, once. */
async function activateDue(now = new Date()) {
  const due = await prisma.flashCampaign.findMany({
    where: { status: "PUBLISHED", activatedAt: null, startsAt: { lte: now }, endsAt: { gt: now } },
    include: { items: { where: { status: "APPROVED" }, include: itemInclude } },
  });
  let activated = 0;
  for (const campaign of due) {
    const { count } = await prisma.flashCampaign.updateMany({ where: { id: campaign.id, activatedAt: null }, data: { activatedAt: now } });
    if (count === 0) continue;
    for (const item of campaign.items) {
      // eslint-disable-next-line no-await-in-loop -- one transaction per listing keeps each price move atomic
      await applyNow(item).catch((err) => logger.warn({ err: err.message, itemId: item.id }, "[flash] could not apply campaign price"));
    }
    activated += 1;
    await eventNotifications.flashCampaignLive(campaign, campaign.items);
  }
  if (activated) await invalidate();
  return activated;
}

/** Campaigns whose end time has passed get every applied price restored, once. */
async function endDue(now = new Date()) {
  const due = await prisma.flashCampaign.findMany({
    where: { status: "PUBLISHED", endedAt: null, endsAt: { lte: now } },
    include: { items: { where: { applied: true }, include: itemInclude } },
  });
  let ended = 0;
  for (const campaign of due) {
    const { count } = await prisma.flashCampaign.updateMany({ where: { id: campaign.id, endedAt: null }, data: { endedAt: now } });
    if (count === 0) continue;
    for (const item of campaign.items) {
      // eslint-disable-next-line no-await-in-loop -- see activateDue
      await restoreNow(item).catch((err) => logger.warn({ err: err.message, itemId: item.id }, "[flash] could not restore price"));
    }
    ended += 1;
    await eventNotifications.flashCampaignEnded(campaign, campaign.items);
  }
  if (ended) await invalidate();
  return ended;
}

module.exports = {
  phase,
  discountPercent,
  current,
  upcoming,
  listOpen,
  listMine,
  apply,
  withdraw,
  listAll,
  getAdmin,
  create,
  update,
  publish,
  cancel,
  addItem,
  reviewItem,
  removeItem,
  activateDue,
  endDue,
};
