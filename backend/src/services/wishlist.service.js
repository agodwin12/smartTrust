const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

const listingInclude = { store: { select: { id: true, name: true, slug: true } }, category: true };

async function list(userId) {
  const rows = await prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { advertisement: { include: listingInclude } },
  });
  return rows.map((row) => ({ id: row.id, savedAt: row.createdAt, advertisement: row.advertisement }));
}

async function add(userId, advertisementId) {
  const ad = await prisma.advertisement.findUnique({ where: { id: advertisementId }, select: { id: true } });
  if (!ad) throw new ApiError(404, "Listing not found.", "ADVERTISEMENT_NOT_FOUND");
  return prisma.wishlistItem.upsert({
    where: { userId_advertisementId: { userId, advertisementId } },
    create: { userId, advertisementId },
    update: {},
  });
}

async function remove(userId, advertisementId) {
  await prisma.wishlistItem.deleteMany({ where: { userId, advertisementId } });
}

/** Sign-in merge: the device's local wishlist joins the account's (unknown ids are ignored). */
async function merge(userId, advertisementIds) {
  const ids = [...new Set(advertisementIds)];
  if (ids.length > 0) {
    const existing = await prisma.advertisement.findMany({ where: { id: { in: ids } }, select: { id: true } });
    await prisma.wishlistItem.createMany({
      data: existing.map((ad) => ({ userId, advertisementId: ad.id })),
      skipDuplicates: true,
    });
  }
  return list(userId);
}

module.exports = { list, add, remove, merge };
