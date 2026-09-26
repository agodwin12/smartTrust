/**
 * One-off: rewrites the old brand name inside stored listing and store text, then busts the
 * listing cache. Safe to re-run (it only touches rows that still contain the old name).
 *
 *   node scripts/rebrand-content.js            # "Smart Market" → "SmartPlaze"
 *   FROM="Old" TO="New" node scripts/rebrand-content.js
 */
require("dotenv").config();
const prisma = require("../src/config/prisma");

async function main() {
  const from = process.env.FROM || "Smart Market";
  const to = process.env.TO || "SmartPlaze";
  const like = `%${from}%`;
  const ads = await prisma.$executeRaw`UPDATE advertisements SET description = REPLACE(description, ${from}, ${to}), title = REPLACE(title, ${from}, ${to}) WHERE description LIKE ${like} OR title LIKE ${like}`;
  const stores = await prisma.$executeRaw`UPDATE stores SET description = REPLACE(description, ${from}, ${to}) WHERE description LIKE ${like}`;
  const campaigns = await prisma.$executeRaw`UPDATE flash_campaigns SET name = REPLACE(name, ${from}, ${to}), description = REPLACE(description, ${from}, ${to}) WHERE name LIKE ${like} OR description LIKE ${like}`;
  await require("../src/services/advertisement.service").invalidateListingCache().catch(() => {});
  console.log(JSON.stringify({ from, to, listings: ads, stores, campaigns }));
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
