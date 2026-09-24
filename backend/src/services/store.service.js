const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { uniqueSlug } = require("../utils/slugify");

const { uploadImage, deleteImageByUrl } = require("./storage.service");

/** Uploads logo/banner files (multipart) and returns the URL fields to merge into the store data. */
async function storeImageUrls(files = {}) {
  const urls = {};
  if (files.logo?.[0]) urls.logoUrl = await uploadImage(files.logo[0], "stores");
  if (files.banner?.[0]) urls.bannerUrl = await uploadImage(files.banner[0], "stores");
  return urls;
}

async function createStore(ownerId, data, files) {
  const existing = await prisma.store.findUnique({ where: { ownerId } });
  if (existing) {
    throw new ApiError(409, "You already have a store.", "STORE_ALREADY_EXISTS");
  }

  const slug = await uniqueSlug(
    data.name,
    (candidate) => prisma.store.findUnique({ where: { slug: candidate } }).then(Boolean)
  );

  // Every store gets a wallet up front — escrow payouts later just update its
  // balance rather than needing to lazily create one at first-sale time.
  const imageUrls = await storeImageUrls(files);

  return prisma.$transaction(async (tx) => {
    const store = await tx.store.create({
      data: { ...data, ...imageUrls, ownerId, slug, status: "ACTIVE" },
    });
    await tx.wallet.create({ data: { storeId: store.id } });
    return store;
  });
}

async function getMine(ownerId) {
  const store = await prisma.store.findUnique({ where: { ownerId } });
  if (!store) throw new ApiError(404, "You don't have a store yet.", "STORE_NOT_FOUND");
  return store;
}

async function updateMine(ownerId, data, files) {
  const store = await getMine(ownerId);
  const imageUrls = await storeImageUrls(files);
  const updated = await prisma.store.update({ where: { id: store.id }, data: { ...data, ...imageUrls } });
  // Best-effort cleanup of replaced images — never blocks the update.
  if (imageUrls.logoUrl && store.logoUrl) deleteImageByUrl(store.logoUrl).catch(() => {});
  if (imageUrls.bannerUrl && store.bannerUrl) deleteImageByUrl(store.bannerUrl).catch(() => {});
  return updated;
}

/** Everything the seller dashboard needs in one round-trip: store, wallet, active plan, counts. */
async function getMineDashboard(ownerId) {
  const store = await prisma.store.findUnique({ where: { ownerId }, include: { wallet: true } });
  if (!store) throw new ApiError(404, "You don't have a store yet.", "STORE_NOT_FOUND");

  const now = new Date();
  const storeOrders = { advertisement: { storeId: store.id } };
  const [subscription, listingCounts, ordersToDeliver, completedOrders, sales, rated] = await Promise.all([
    prisma.subscription.findFirst({
      where: { storeId: store.id, status: "ACTIVE", expiresAt: { gt: now } },
      include: { plan: true },
      orderBy: { expiresAt: "desc" },
    }),
    prisma.advertisement.groupBy({ by: ["status"], where: { storeId: store.id }, _count: { _all: true } }),
    prisma.order.count({ where: { ...storeOrders, status: { in: ["PAID", "CONFIRMED"] }, sellerConfirmedAt: null } }),
    prisma.order.count({ where: { ...storeOrders, status: "COMPLETED" } }),
    prisma.order.aggregate({ where: { ...storeOrders, status: "COMPLETED" }, _sum: { totalAmount: true } }),
    require("./review.service").withRatings([store]),
  ]);

  const listings = { DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 };
  for (const row of listingCounts) listings[row.status] = row._count._all;

  const { wallet, ...storeFields } = rated[0];
  return {
    ...storeFields,
    wallet: wallet ? { balance: wallet.balance, currency: wallet.currency } : null,
    subscription,
    stats: { listings, ordersToDeliver, completedOrders, totalSales: Number(sales._sum.totalAmount ?? 0) },
  };
}

async function getBySlug(slug) {
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store || store.status !== "ACTIVE") {
    throw new ApiError(404, "Store not found.", "STORE_NOT_FOUND");
  }
  const [withRating] = await require("./review.service").withRatings([store]); // lazy: review.service has no dependency back here
  return withRating;
}

async function listStores({ page = 1, pageSize = 20, search } = {}) {
  const where = {
    status: "ACTIVE",
    ...(search && { name: { contains: search, mode: "insensitive" } }),
  };

  const [items, total] = await Promise.all([
    prisma.store.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.store.count({ where }),
  ]);

  return { items: await require("./review.service").withRatings(items), total, page, pageSize };
}

/** Staff view: every store regardless of status, with owner, balance and listing count. */
async function listAll({ page = 1, pageSize = 20, status, search } = {}) {
  const where = {
    ...(status && { status }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { owner: { email: { contains: search, mode: "insensitive" } } },
      ],
    }),
  };
  const [items, total] = await Promise.all([
    prisma.store.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        wallet: { select: { balance: true } },
        _count: { select: { advertisements: true, reviews: true } },
      },
    }),
    prisma.store.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

async function updateStatus(storeId, status) {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new ApiError(404, "Store not found.", "STORE_NOT_FOUND");
  const updated = await prisma.store.update({ where: { id: storeId }, data: { status } });
  // Suspending/reactivating a store shows or hides all its listings — bust the cached pages.
  await require("./advertisement.service").invalidateListingCache(); // lazy: advertisement.service is required by order.service which store.service must not cycle into
  return updated;
}

module.exports = {
  getMineDashboard,
  listAll, createStore, getMine, updateMine, getBySlug, listStores, updateStatus };
