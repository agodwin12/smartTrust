const prisma = require("../config/prisma");
const advertisementService = require("../services/advertisement.service");

// Public listing pages are cached for a few seconds; any seller/staff write busts them.
const bust = () => advertisementService.invalidateListingCache().catch(() => {});
const audit = require("../services/audit.service");
const ApiError = require("../utils/ApiError");
const { OPERATIONS } = require("../utils/roles");

async function myStoreId(userId, { requireApproved = false } = {}) {
  const store = await prisma.store.findUnique({ where: { ownerId: userId } });
  if (!store) throw new ApiError(404, "You need a store before posting an advertisement.", "STORE_NOT_FOUND");
  if (requireApproved) require("../services/store.service").assertApproved(store);
  return store.id;
}

async function create(req, res) {
  const storeId = await myStoreId(req.user.id);
  const ad = await advertisementService.create(storeId, req.body, req.files);
  audit.record(req, { action: "AD_CREATED", entityType: "Advertisement", entityId: ad.id, metadata: { title: ad.title, storeId } });
  await bust();
  res.status(201).json({ advertisement: ad });
}

async function update(req, res) {
  const storeId = await myStoreId(req.user.id);
  const ad = await advertisementService.update(req.params.id, storeId, req.body, req.files);
  await bust();
  res.json({ advertisement: ad });
}

async function publish(req, res) {
  const storeId = await myStoreId(req.user.id, { requireApproved: true });
  const ad = await advertisementService.publish(req.params.id, storeId);
  audit.record(req, { action: "AD_PUBLISHED", entityType: "Advertisement", entityId: ad.id, metadata: { storeId } });
  await bust();
  res.json({ advertisement: ad });
}

async function archive(req, res) {
  const isAdmin = OPERATIONS.includes(req.user.role);
  const storeId = isAdmin ? null : await myStoreId(req.user.id);
  const ad = await advertisementService.archive(req.params.id, storeId, isAdmin);
  audit.record(req, { action: "AD_ARCHIVED", entityType: "Advertisement", entityId: ad.id, metadata: { byStaff: isAdmin } });
  await bust();
  res.json({ advertisement: ad });
}

async function list(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
  const toNumber = (value) => {
    const n = Number(value);
    return value !== undefined && value !== "" && Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const result = await advertisementService.list({
    page,
    pageSize,
    categoryId: req.query.categoryId,
    categorySlug: req.query.categorySlug,
    storeId: req.query.storeId,
    search: req.query.search,
    sort: req.query.sort,
    minPrice: toNumber(req.query.minPrice),
    maxPrice: toNumber(req.query.maxPrice),
    condition: req.query.condition,
    location: req.query.location,
    deals: req.query.deals === "true" || req.query.deals === "1",
  });
  res.json(result);
}

async function getBySlug(req, res) {
  const ad = await advertisementService.getBySlug(req.params.slug);
  res.json({ advertisement: ad });
}

async function listAll(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
  res.json(await advertisementService.listAll({ page, pageSize, status: req.query.status, search: req.query.search, storeId: req.query.storeId }));
}

async function getMine(req, res) {
  const storeId = await myStoreId(req.user.id);
  const ad = await advertisementService.getOwned(req.params.id, storeId);
  res.json({ advertisement: ad });
}

async function listMine(req, res) {
  const storeId = await myStoreId(req.user.id);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
  const result = await advertisementService.listMine(storeId, { page, pageSize, status: req.query.status });
  res.json(result);
}

async function feature(req, res) {
  const ad = await advertisementService.feature(req.params.id, req.user, req.body.durationHours);
  audit.record(req, {
    action: "AD_FEATURED",
    entityType: "Advertisement",
    entityId: ad.id,
    metadata: { featuredUntil: ad.featuredUntil, byStaff: OPERATIONS.includes(req.user.role) },
  });
  await bust();
  res.json({ advertisement: ad });
}

async function unfeature(req, res) {
  const ad = await advertisementService.unfeature(req.params.id, req.user);
  audit.record(req, { action: "AD_UNFEATURED", entityType: "Advertisement", entityId: ad.id });
  await bust();
  res.json({ advertisement: ad });
}

async function listHero(req, res) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);
  const items = await advertisementService.listHero({ categoryId: req.query.categoryId, limit });
  res.json({ items });
}

module.exports = {
  listAll,
  getMine, create, update, publish, archive, list, getBySlug, listMine, feature, unfeature, listHero };
