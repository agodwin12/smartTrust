/**
 * Replaces a store's logo with a local image (uploaded to R2 like a seller upload).
 *
 *   SLUG=smart-trust FILE=scripts/assets/smartplaze-store-logo.png node scripts/set-store-logo.js
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const prisma = require("../src/config/prisma");
const { uploadImage } = require("../src/services/storage.service");

async function main() {
  const { SLUG, FILE } = process.env;
  if (!SLUG || !FILE) throw new Error("SLUG and FILE are required.");
  const store = await prisma.store.findUnique({ where: { slug: SLUG } });
  if (!store) throw new Error(`Store "${SLUG}" not found.`);
  const buffer = fs.readFileSync(FILE);
  const logoUrl = await uploadImage({ buffer, size: buffer.length, originalname: path.basename(FILE), mimetype: "image/png" }, "stores");
  await prisma.store.update({ where: { id: store.id }, data: { logoUrl } });
  await require("../src/services/advertisement.service").invalidateListingCache().catch(() => {});
  console.log(`${store.name}: logo → ${logoUrl}`);
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
