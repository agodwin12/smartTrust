/**
 * Creates or updates one category from the command line and busts the category cache.
 *
 *   NAME="Second Hand" SLUG=second-hand IMAGE_URL=https://… node scripts/upsert-category.js
 *   NAME="Phones" SLUG=used-phones PARENT_SLUG=second-hand node scripts/upsert-category.js
 *
 * SLUG defaults to a slugified NAME. PARENT_SLUG (optional) nests the category.
 */
require("dotenv").config();
const prisma = require("../src/config/prisma");
const cacheService = require("../src/services/cache.service");
const { slugify } = require("../src/utils/slugify");

async function main() {
  const { NAME, SLUG, IMAGE_URL, PARENT_SLUG } = process.env;
  if (!NAME) throw new Error("NAME is required.");
  const slug = SLUG || slugify(NAME);
  let parentId = null;
  if (PARENT_SLUG) {
    const parent = await prisma.category.findUnique({ where: { slug: PARENT_SLUG } });
    if (!parent) throw new Error(`Parent category "${PARENT_SLUG}" not found.`);
    parentId = parent.id;
  }
  const category = await prisma.category.upsert({
    where: { slug },
    create: { name: NAME, slug, imageUrl: IMAGE_URL || null, parentId },
    update: { name: NAME, ...(IMAGE_URL ? { imageUrl: IMAGE_URL } : {}), parentId },
  });
  await cacheService.invalidatePrefix("categories:");
  console.log(`${category.name} (${category.slug}) ready — id ${category.id}${parentId ? ` under ${PARENT_SLUG}` : ""}`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit();
  });
