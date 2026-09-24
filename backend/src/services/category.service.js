const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { uniqueSlug } = require("../utils/slugify");
const { uploadImage, deleteImageByUrl } = require("./storage.service");
const cacheService = require("./cache.service");

const CACHE_PREFIX = "categories:";
const CACHE_TTL_SECONDS = 60;

async function assertParentExists(parentId) {
  if (!parentId) return;
  const parent = await prisma.category.findUnique({ where: { id: parentId } });
  if (!parent) throw new ApiError(422, "parentId does not match an existing category.", "PARENT_NOT_FOUND");
}

async function createCategory({ name, parentId }, file) {
  await assertParentExists(parentId);

  const slug = await uniqueSlug(
    name,
    (candidate) => prisma.category.findUnique({ where: { slug: candidate } }).then(Boolean)
  );

  const imageUrl = file ? await uploadImage(file, "categories") : null;

  const category = await prisma.category.create({ data: { name, slug, parentId, imageUrl } });
  await cacheService.invalidatePrefix(CACHE_PREFIX);
  return category;
}

async function updateCategory(id, { name, parentId, removeImage }, file) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new ApiError(404, "Category not found.", "CATEGORY_NOT_FOUND");

  if (parentId !== undefined) {
    if (parentId === id) {
      throw new ApiError(422, "A category cannot be its own parent.", "INVALID_PARENT");
    }
    await assertParentExists(parentId);
  }

  let imageUrl = category.imageUrl;
  if (file) {
    imageUrl = await uploadImage(file, "categories");
    await deleteImageByUrl(category.imageUrl);
  } else if (removeImage) {
    await deleteImageByUrl(category.imageUrl);
    imageUrl = null;
  }

  const updated = await prisma.category.update({
    where: { id },
    data: { ...(name && { name }), ...(parentId !== undefined && { parentId }), imageUrl },
  });
  await cacheService.invalidatePrefix(CACHE_PREFIX);
  return updated;
}

// Categories are admin-curated and read constantly (every nav menu, every homepage
// load) — a short TTL turns "every page load hits Postgres" into "at most one query
// every 60 seconds, no matter how many concurrent visitors," while still picking up
// an admin's edit within a minute. Any write busts the whole namespace immediately
// instead of waiting out the TTL.
async function listCategories({ parentId, page = 1, pageSize = 50, withCounts = false } = {}) {
  const cacheKey = `${CACHE_PREFIX}list:${parentId ?? "all"}:${page}:${pageSize}:${withCounts ? "c" : "n"}`;

  return cacheService.getOrSet(cacheKey, CACHE_TTL_SECONDS, async () => {
    const where = parentId === undefined ? {} : { parentId: parentId === "root" ? null : parentId };

    const [items, total] = await Promise.all([
      prisma.category.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.category.count({ where }),
    ]);

    if (!withCounts || items.length === 0) return { items, total, page, pageSize };

    // Live (publicly visible) listing count per category, sub-categories rolled up
    // into their parent. Cached with the list, so this costs one groupBy per minute.
    const { visibilityFilter } = require("./advertisement.service"); // lazy: avoids a require cycle
    const [grouped, allCategories] = await Promise.all([
      prisma.advertisement.groupBy({ by: ["categoryId"], where: visibilityFilter(), _count: { _all: true } }),
      prisma.category.findMany({ select: { id: true, parentId: true } }),
    ]);
    const direct = new Map(grouped.map((g) => [g.categoryId, g._count._all]));
    const parentOf = new Map(allCategories.map((c) => [c.id, c.parentId]));
    const rolledUp = new Map();
    for (const [categoryId, count] of direct) {
      rolledUp.set(categoryId, (rolledUp.get(categoryId) ?? 0) + count);
      const parentId = parentOf.get(categoryId);
      if (parentId) rolledUp.set(parentId, (rolledUp.get(parentId) ?? 0) + count);
    }

    return {
      items: items.map((item) => ({ ...item, productCount: rolledUp.get(item.id) ?? 0 })),
      total,
      page,
      pageSize,
    };
  });
}

async function getBySlug(slug) {
  const cacheKey = `${CACHE_PREFIX}slug:${slug}`;

  const category = await cacheService.getOrSet(cacheKey, CACHE_TTL_SECONDS, () =>
    prisma.category.findUnique({
      where: { slug },
      include: { children: { orderBy: { name: "asc" } } },
    })
  );

  if (!category) throw new ApiError(404, "Category not found.", "CATEGORY_NOT_FOUND");
  return category;
}

async function deleteCategory(id) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { children: true, advertisements: true } } },
  });
  if (!category) throw new ApiError(404, "Category not found.", "CATEGORY_NOT_FOUND");

  if (category._count.children > 0) {
    throw new ApiError(409, "Remove or reassign its subcategories first.", "CATEGORY_HAS_CHILDREN");
  }
  if (category._count.advertisements > 0) {
    throw new ApiError(409, "This category still has advertisements assigned to it.", "CATEGORY_IN_USE");
  }

  await prisma.category.delete({ where: { id } });
  await deleteImageByUrl(category.imageUrl);
  await cacheService.invalidatePrefix(CACHE_PREFIX);
}

module.exports = { createCategory, updateCategory, listCategories, getBySlug, deleteCategory };
