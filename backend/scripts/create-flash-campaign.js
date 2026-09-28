/**
 * Creates, fills and publishes a flash campaign from one store's listings, then applies the
 * campaign prices at once (instead of waiting for the 30-second job).
 *
 *   STORE_SLUG=smart-trust NAME="SmartPlaze Flash Sale" DAYS=7 COUNT=12 node scripts/create-flash-campaign.js
 *   DRY_RUN=1 …  → prints the picks and prices, creates nothing.
 *
 * Picks the most viewed published listings with a photo, spread across departments and sub-categories, and gives each
 * a 12–25 % discount rounded to a clean amount (100 FCFA steps, 500 above 50 000).
 */
require("dotenv").config();
const prisma = require("../src/config/prisma");
const flash = require("../src/services/flashCampaign.service");

const DISCOUNTS = [0.15, 0.2, 0.12, 0.25, 0.18, 0.15, 0.2, 0.12, 0.25, 0.18, 0.15, 0.2];
const DOUALA_OFFSET_MS = 60 * 60 * 1000;

function campaignPrice(price, discount) {
  const step = price >= 50000 ? 500 : 100;
  let value = Math.floor((price * (1 - discount)) / step) * step;
  if (value > price * 0.9) value = Math.floor((price * 0.9) / step) * step; // at least 10 % off
  return Math.max(step, value);
}

async function main() {
  const { STORE_SLUG = "smart-trust", NAME = "SmartPlaze Flash Sale", DESCRIPTION, DRY_RUN } = process.env;
  const days = parseInt(process.env.DAYS || "7", 10);
  const count = parseInt(process.env.COUNT || "12", 10);

  const store = await prisma.store.findUnique({ where: { slug: STORE_SLUG } });
  if (!store || store.status !== "ACTIVE") throw new Error(`Store "${STORE_SLUG}" not found or not active.`);
  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN", status: "ACTIVE" }, orderBy: { createdAt: "asc" } });

  const listings = (
    await prisma.advertisement.findMany({
      where: { storeId: store.id, status: "PUBLISHED", compareAtPrice: null },
      orderBy: [{ viewCount: "desc" }, { createdAt: "desc" }],
      select: { id: true, title: true, price: true, categoryId: true, images: true },
    })
  ).filter((ad) => Array.isArray(ad.images) && ad.images.length > 0);
  // Variety: slots shared between departments (root categories) in proportion to their stock,
  // and within a department, one listing per sub-category in turn (most viewed first).
  const categories = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId]));
  const rootOf = (id) => {
    let current = id;
    while (parentOf.get(current)) current = parentOf.get(current);
    return current;
  };
  const byRoot = new Map();
  for (const ad of listings) byRoot.set(rootOf(ad.categoryId), [...(byRoot.get(rootOf(ad.categoryId)) ?? []), ad]);
  const roots = [...byRoot.entries()].sort((a, b) => b[1].length - a[1].length);
  const slots = roots.map(([, ads]) => Math.max(1, Math.floor((ads.length / listings.length) * count)));
  for (let i = 0; slots.reduce((a, b) => a + b, 0) < Math.min(count, listings.length); i = (i + 1) % roots.length) {
    if (slots[i] < roots[i][1].length) slots[i] += 1;
  }
  const picks = [];
  roots.forEach(([, ads], i) => {
    const bySub = new Map();
    for (const ad of ads) bySub.set(ad.categoryId, [...(bySub.get(ad.categoryId) ?? []), ad]);
    const queues = [...bySub.values()];
    const taken = [];
    while (taken.length < slots[i] && queues.some((q) => q.length)) {
      for (const q of queues) if (q.length && taken.length < slots[i]) taken.push(q.shift());
    }
    picks.push(...taken);
  });
  picks.splice(count);

  const items = picks.map((ad, i) => ({ ad, price: Number(ad.price), campaignPrice: campaignPrice(Number(ad.price), DISCOUNTS[i % DISCOUNTS.length]) }));
  const startsAt = new Date();
  // Ends at 23:59 Douala time on the last day.
  const doualaToday = new Date(startsAt.getTime() + DOUALA_OFFSET_MS).toISOString().slice(0, 10);
  const endsAt = new Date(Date.parse(`${doualaToday}T23:59:00Z`) - DOUALA_OFFSET_MS + days * 24 * 60 * 60 * 1000);

  console.log(`${NAME}: ${startsAt.toISOString()} → ${endsAt.toISOString()} (${items.length} items)`);
  for (const it of items) console.log(`  ${it.ad.title.slice(0, 48).padEnd(48)} ${it.price.toLocaleString("en-US").padStart(9)} → ${it.campaignPrice.toLocaleString("en-US").padStart(9)} FCFA (-${Math.round((1 - it.campaignPrice / it.price) * 100)}%)`);
  if (DRY_RUN) return console.log("DRY RUN — nothing created.");

  const campaign = await flash.create(
    {
      name: NAME,
      description: DESCRIPTION || "Limited-time prices on Smart Trust favourites. Every order is protected by SmartPlaze escrow.",
      startsAt,
      endsAt,
      minDiscountPercent: 10,
      applicationsOpen: true,
    },
    admin?.id
  );
  for (const it of items) await flash.addItem(campaign.id, { advertisementId: it.ad.id, campaignPrice: it.campaignPrice }, admin?.id);
  await flash.publish(campaign.id);
  const activation = await flash.activateDue(new Date());
  await require("../src/services/advertisement.service").invalidateListingCache().catch(() => {});
  console.log(`Campaign ${campaign.slug} published and live (${JSON.stringify(activation)}).`);
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
