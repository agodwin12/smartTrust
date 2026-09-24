#!/usr/bin/env node
/*
 * Imports the Smart Trust catalogue (scripts/catalog/products.json) straight through the
 * service layer: same slug rules, R2 uploads, subscription quota and cache invalidation as
 * the seller area, without the HTTP upload rate limit.
 *
 * What it does, idempotently:
 *   1. owner account + "Smart Trust" store (ACTIVE, logo on R2, wallet, Premium subscription)
 *   2. one PUBLISHED listing per product (skipped when the store already has that title)
 *   3. `featured: true` products pinned in the hero for FEATURED_DAYS
 *
 *   OWNER_PASSWORD=… [IMAGES_DIR=../images/drive-download-20260923T215307Z-1-001] \
 *   node scripts/import-catalog-products.js
 */
require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const prisma = require("../src/config/prisma");
const { auth } = require("../src/config/env");
const { uploadImage } = require("../src/services/storage.service");
const advertisementService = require("../src/services/advertisement.service");
const cacheService = require("../src/services/cache.service");
const { uniqueSlug } = require("../src/utils/slugify");

const IMAGES_DIR = path.resolve(__dirname, "..", process.env.IMAGES_DIR || "../images/drive-download-20260923T215307Z-1-001");
const OWNER_PASSWORD = process.env.OWNER_PASSWORD;
const PLAN_NAME = process.env.PLAN_NAME || "Premium";
const FEATURED_DAYS = parseInt(process.env.FEATURED_DAYS || "365", 10);
const LOCATION = "Douala";

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "catalog", "products.json"), "utf8"));

/** Multer-shaped file object, which is what the storage service expects. */
function fileFrom(relative) {
  const absolute = path.join(IMAGES_DIR, relative);
  const buffer = fs.readFileSync(absolute);
  const ext = path.extname(absolute).toLowerCase();
  return { buffer, size: buffer.length, originalname: path.basename(absolute), mimetype: ext === ".png" ? "image/png" : "image/jpeg" };
}

const money = (n) => `${Number(n).toLocaleString("en-US")} FCFA`;

function describe(product) {
  const lines = [product.description];
  if (product.range) lines.push(`Price range: ${money(product.range[0])} – ${money(product.range[1])} depending on model and quantity; the price shown is the standard retail price.`);
  lines.push(`Sold by Smart Trust, ${LOCATION}. Delivery across Cameroon; pay through Smart Market escrow or cash at handover.`);
  return lines.join("\n\n");
}

async function ensureOwner() {
  const { email, firstName, lastName } = manifest.store.owner;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { user: existing, created: false };
  if (!OWNER_PASSWORD) throw new Error("OWNER_PASSWORD is required to create the store owner account.");
  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, auth.bcryptSaltRounds);
  const user = await prisma.user.create({ data: { email, firstName, lastName, passwordHash, role: "CUSTOMER", status: "ACTIVE", emailVerifiedAt: new Date() } });
  return { user, created: true };
}

async function ensureStore(owner) {
  const spec = manifest.store;
  let store = await prisma.store.findUnique({ where: { ownerId: owner.id } });
  let created = false;
  if (!store) {
    const slug = await uniqueSlug(spec.slug || spec.name, (candidate) => prisma.store.findUnique({ where: { slug: candidate } }).then(Boolean));
    const logoUrl = spec.logo ? await uploadImage(fileFrom(spec.logo), "stores") : null;
    store = await prisma.store.create({
      data: { ownerId: owner.id, name: spec.name, slug, description: spec.description, location: spec.location, logoUrl, status: "ACTIVE" },
    });
    created = true;
  } else if (store.status !== "ACTIVE") {
    store = await prisma.store.update({ where: { id: store.id }, data: { status: "ACTIVE" } });
  }
  await prisma.wallet.upsert({ where: { storeId: store.id }, update: {}, create: { storeId: store.id } });

  let subscription = await prisma.subscription.findFirst({ where: { storeId: store.id, status: "ACTIVE", expiresAt: { gt: new Date() } }, include: { plan: true } });
  if (!subscription) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { name: PLAN_NAME } });
    if (!plan) throw new Error(`Subscription plan "${PLAN_NAME}" not found.`);
    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
    subscription = await prisma.subscription.create({ data: { storeId: store.id, planId: plan.id, status: "ACTIVE", startsAt, expiresAt }, include: { plan: true } });
  }
  return { store, subscription, created };
}

async function importProducts(store, owner) {
  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryId = new Map(categories.map((c) => [c.slug, c.id]));
  const existingTitles = new Set((await prisma.advertisement.findMany({ where: { storeId: store.id }, select: { title: true } })).map((a) => a.title));
  const summary = { created: [], skipped: [], failed: [], featured: [] };

  for (const product of manifest.products) {
    if (existingTitles.has(product.title)) {
      summary.skipped.push(product.title);
      continue;
    }
    const catId = categoryId.get(product.category);
    if (!catId) {
      summary.failed.push(`${product.title}: category "${product.category}" not found`);
      continue;
    }
    try {
      const file = fileFrom(product.file);
      const draft = await advertisementService.create(
        store.id,
        { title: product.title, description: describe(product), price: product.price, categoryId: catId, condition: "NEW", location: LOCATION },
        [file]
      );
      const published = await advertisementService.publish(draft.id, store.id);
      existingTitles.add(product.title);
      summary.created.push(`${published.title} → ${published.slug} (${money(product.price)}${product.priced === "estimate" ? ", estimated" : ""})`);

      if (product.featured) {
        const featuredAt = new Date();
        const featuredUntil = new Date(featuredAt.getTime() + FEATURED_DAYS * 24 * 60 * 60 * 1000);
        await prisma.advertisement.update({ where: { id: published.id }, data: { featuredAt, featuredUntil, featuredById: owner.id } });
        summary.featured.push(published.title);
      }
    } catch (error) {
      summary.failed.push(`${product.title}: ${error.message}`);
    }
  }
  return summary;
}

async function main() {
  const { user: owner, created: ownerCreated } = await ensureOwner();
  const { store, subscription, created: storeCreated } = await ensureStore(owner);
  console.log(`owner   ${owner.email} ${ownerCreated ? "(created)" : "(existing)"}`);
  console.log(`store   ${store.name} /stores/${store.slug} ${storeCreated ? "(created)" : "(existing)"} · ${subscription.plan.name} plan, ${subscription.adsUsed}/${subscription.plan.adQuota} ads used`);

  const summary = await importProducts(store, owner);

  await Promise.all([cacheService.invalidatePrefix("ads:"), cacheService.invalidatePrefix("hero:"), cacheService.invalidatePrefix("categories:"), cacheService.invalidatePrefix("stores:")]);

  for (const [label, items] of Object.entries(summary)) {
    console.log(`${label.toUpperCase()} (${items.length})`);
    for (const line of items) console.log("  -", line);
  }
  const used = await prisma.subscription.findUnique({ where: { id: subscription.id } });
  console.log(`quota   ${used.adsUsed}/${subscription.plan.adQuota} ads used on the ${subscription.plan.name} plan`);
  if (summary.failed.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  // The cache client keeps the event loop alive after the work is done: exit explicitly.
  .finally(() => prisma.$disconnect().finally(() => process.exit(process.exitCode ?? 0)));
