const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const eventNotifications = require("./eventNotifications");

/** A buyer reviews the store once per COMPLETED order. */
async function create(orderId, buyerId, { rating, comment }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { review: true, advertisement: { select: { title: true, storeId: true, store: { select: { ownerId: true, slug: true } } } } },
  });
  if (!order || order.buyerId !== buyerId) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");
  if (order.status !== "COMPLETED") {
    throw new ApiError(409, "You can review an order once it is completed.", "ORDER_NOT_COMPLETED");
  }
  if (order.review) throw new ApiError(409, "This order has already been reviewed.", "REVIEW_EXISTS");

  const review = await prisma.review.create({
    data: { orderId, buyerId, storeId: order.advertisement.storeId, rating, comment: comment || null },
  });

  void eventNotifications.reviewReceived(review, {
    ownerId: order.advertisement.store.ownerId,
    productTitle: order.advertisement.title,
    storeSlug: order.advertisement.store.slug,
  });

  return review;
}

async function listForStore(storeId, { page = 1, pageSize = 20 } = {}) {
  const where = { storeId };
  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        buyer: { select: { firstName: true, lastName: true } },
        order: { select: { advertisement: { select: { title: true, slug: true } } } },
      },
    }),
    prisma.review.count({ where }),
  ]);
  return {
    items: items.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      buyerName: `${r.buyer.firstName} ${r.buyer.lastName.charAt(0)}.`,
      product: r.order.advertisement,
    })),
    total,
    page,
    pageSize,
  };
}

/** Map of storeId → { rating, reviewCount } for a batch of stores (one groupBy). */
async function ratingsFor(storeIds) {
  if (storeIds.length === 0) return new Map();
  const grouped = await prisma.review.groupBy({
    by: ["storeId"],
    where: { storeId: { in: storeIds } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(grouped.map((g) => [g.storeId, { rating: Math.round((g._avg.rating ?? 0) * 10) / 10, reviewCount: g._count._all }]));
}

/** Attaches rating/reviewCount to store rows (undefined when the store has no reviews yet). */
async function withRatings(stores) {
  const ratings = await ratingsFor(stores.map((s) => s.id));
  return stores.map((store) => ({ ...store, ...(ratings.get(store.id) ?? {}) }));
}

module.exports = { create, listForStore, ratingsFor, withRatings };
