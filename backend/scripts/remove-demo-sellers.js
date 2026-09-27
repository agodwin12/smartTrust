/**
 * Removes the demo seller accounts created by prisma/seed.js, with their stores, listings,
 * subscriptions, wallets and every order placed on those listings (payments, escrow,
 * disputes, refunds and reviews go with the orders). Smart Trust and real users are kept.
 *
 *   DRY_RUN=1 node scripts/remove-demo-sellers.js   # report only
 *   node scripts/remove-demo-sellers.js             # delete
 *   EMAILS="a@x.com,b@y.com" node scripts/remove-demo-sellers.js
 */
require("dotenv").config();
const prisma = require("../src/config/prisma");
const cacheService = require("../src/services/cache.service");

const DEMO_EMAILS = ["tech.elite", "style.avenue", "home.gallery", "luxury.finds", "motor.hub", "fit.zone", "fresh.basket"].map((n) => `${n}@smartplaze.com`);

async function main() {
  const emails = process.env.EMAILS ? process.env.EMAILS.split(",").map((e) => e.trim().toLowerCase()) : DEMO_EMAILS;
  const dryRun = Boolean(process.env.DRY_RUN);
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, include: { store: { include: { wallet: true } } } });
  const userIds = users.map((u) => u.id);
  const storeIds = users.filter((u) => u.store).map((u) => u.store.id);
  const listingIds = (await prisma.advertisement.findMany({ where: { storeId: { in: storeIds } }, select: { id: true } })).map((a) => a.id);

  const orders = await prisma.order.findMany({
    where: { OR: [{ advertisementId: { in: listingIds } }, { buyerId: { in: userIds } }] },
    include: { buyer: { select: { email: true } }, advertisement: { select: { title: true } }, escrow: true, payment: true },
  });
  const realBuyerOrders = orders.filter((o) => !userIds.includes(o.buyerId));
  const moneyHeld = orders.filter((o) => o.escrow?.status === "HELD");
  const [subscriptions, withdrawals, reviews, flashItems, wishlists] = await Promise.all([
    prisma.subscription.count({ where: { storeId: { in: storeIds } } }),
    prisma.withdrawal.count({ where: { storeId: { in: storeIds } } }),
    prisma.review.count({ where: { storeId: { in: storeIds } } }),
    prisma.flashCampaignItem.count({ where: { storeId: { in: storeIds } } }),
    prisma.wishlistItem.count({ where: { advertisementId: { in: listingIds } } }),
  ]);

  const report = {
    sellers: users.map((u) => `${u.email} (${u.store?.name ?? "no store"}, wallet ${u.store?.wallet?.balance ?? 0})`),
    notFound: emails.filter((e) => !users.some((u) => u.email === e)),
    listings: listingIds.length,
    orders: orders.length,
    ordersFromOtherBuyers: realBuyerOrders.map((o) => `${o.id.slice(-8).toUpperCase()} ${o.status} by ${o.buyer.email} — ${o.advertisement?.title}`),
    ordersWithMoneyInEscrow: moneyHeld.length,
    subscriptions,
    withdrawals,
    reviews,
    flashCampaignItems: flashItems,
    wishlistEntries: wishlists,
  };
  console.log(JSON.stringify(report, null, 2));
  if (dryRun) return console.log("DRY RUN — nothing deleted.");
  if (moneyHeld.length) throw new Error("Some orders still hold money in escrow — resolve them first. Nothing deleted.");

  const orderIds = orders.map((o) => o.id);
  const groupIds = [...new Set(orders.map((o) => o.groupId).filter(Boolean))];
  await prisma.$transaction(async (tx) => {
    await tx.order.deleteMany({ where: { id: { in: orderIds } } }); // payments, escrow, disputes, refunds, reviews cascade
    // Cart checkouts left without any line are removed too (their payment cascades).
    for (const groupId of groupIds) {
      if ((await tx.order.count({ where: { groupId } })) === 0) await tx.checkoutGroup.delete({ where: { id: groupId } });
    }
    await tx.user.deleteMany({ where: { id: { in: userIds } } }); // stores → listings, subscriptions, wallets, withdrawals, flash items, wishlist entries
    await tx.auditLog.create({ data: { actorRole: "SYSTEM", action: "DEMO_SELLERS_REMOVED", entityType: "User", metadata: { emails: users.map((u) => u.email), listings: listingIds.length, orders: orderIds.length } } });
  });
  await require("../src/services/advertisement.service").invalidateListingCache().catch(() => {});
  await cacheService.invalidatePrefix("categories:").catch(() => {});
  for (const id of userIds) await cacheService.invalidateKey(cacheService.userKey(id)).catch(() => {});
  console.log(`Removed ${users.length} demo sellers, ${listingIds.length} listings and ${orderIds.length} orders.`);
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
