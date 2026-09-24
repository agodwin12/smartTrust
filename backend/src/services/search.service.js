const prisma = require("../config/prisma");
const cacheService = require("./cache.service");
const { visibilityFilter } = require("./advertisement.service");

// Typeahead is the chattiest read in the app (one call per keystroke pause), so results are
// cached briefly per normalised query and the payload stays tiny: no descriptions, one image.
const CACHE_PREFIX = "search:suggest:";
const CACHE_TTL_SECONDS = 30;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 80;
const LIMITS = { products: 5, categories: 3, stores: 3 };

const normalise = (raw) => String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);

const empty = (query) => ({ query, products: [], categories: [], stores: [] });

/** Instant suggestions for the header search: a few products, categories and stores matching `q`. */
async function suggest(rawQuery) {
  const query = normalise(rawQuery);
  if (query.length < MIN_QUERY_LENGTH) return empty(query);

  return cacheService.getOrSet(`${CACHE_PREFIX}${query.toLowerCase()}`, CACHE_TTL_SECONDS, async () => {
    const contains = { contains: query, mode: "insensitive" };
    const [products, categories, stores] = await Promise.all([
      prisma.advertisement.findMany({
        where: { ...visibilityFilter(), title: contains },
        orderBy: [{ viewCount: "desc" }, { createdAt: "desc" }],
        take: LIMITS.products,
        select: { id: true, title: true, slug: true, price: true, images: true, category: { select: { name: true, slug: true } } },
      }),
      prisma.category.findMany({
        where: { name: contains },
        orderBy: { name: "asc" },
        take: LIMITS.categories,
        select: { id: true, name: true, slug: true, parent: { select: { name: true } } },
      }),
      prisma.store.findMany({
        where: { status: "ACTIVE", name: contains },
        orderBy: { name: "asc" },
        take: LIMITS.stores,
        select: { id: true, name: true, slug: true, logoUrl: true, location: true },
      }),
    ]);

    return {
      query,
      products: products.map(({ images, ...product }) => ({ ...product, image: Array.isArray(images) && images.length ? images[0] : null })),
      categories,
      stores,
    };
  });
}

module.exports = { suggest, MIN_QUERY_LENGTH };
