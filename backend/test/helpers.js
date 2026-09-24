require("./bootstrap");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const request = require("supertest");
const prisma = require("../src/config/prisma");
const redis = require("../src/config/redis");
const app = require("../src/app");

let seq = 0;
const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Empties every table (except the migration ledger) and the test Redis database. */
async function resetDb() {
  await waitForRedis(3000);
  // Belt and braces: a test file that loads the app before this bootstrap would be connected to
  // the developer's real database. Never truncate anything that is not a *_test database.
  const [{ current_database: dbName }] = await prisma.$queryRawUnsafe("SELECT current_database()");
  if (!/_test$/.test(dbName)) {
    throw new Error(`resetDb() refused: connected to "${dbName}", not a *_test database. Require ./helpers (or ./bootstrap) before ../src/app.`);
  }
  const rows = await prisma.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`);
  if (rows.length) await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${rows.map((r) => `"${r.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  try {
    if (redis.status === "ready") await redis.flushdb();
  } catch {
    /* Redis is optional in tests */
  }
}

async function teardown() {
  await prisma.$disconnect();
  try {
    await redis.quit();
  } catch {
    /* already closed */
  }
}

async function createUser({ role = "CUSTOMER", verified = true, password = "Passw0rd123", status = "ACTIVE", email, firstName = "Test", lastName = "User" } = {}) {
  const user = await prisma.user.create({
    data: {
      email: email ?? `${role.toLowerCase()}-${uid()}@test.dev`,
      passwordHash: await bcrypt.hash(password, 4),
      firstName,
      lastName,
      role,
      status,
      emailVerifiedAt: verified ? new Date() : null,
    },
  });
  return { user, password };
}

async function createPlan({ name = `Plan ${uid()}`, adQuota = 10, durationDays = 30, price = 5000, heroEligible = false, heroDurationHours = null } = {}) {
  return prisma.subscriptionPlan.create({ data: { name, adQuota, durationDays, price, heroEligible, heroDurationHours, isActive: true } });
}

/** Store + wallet, and by default an active 30-day subscription on a fresh plan. */
async function createStore(ownerId, { status = "ACTIVE", balance = 0, subscription = true, plan, adQuota = 10, expiresAt } = {}) {
  const store = await prisma.store.create({
    data: { ownerId, name: `Store ${uid()}`, slug: `store-${uid()}`, status, location: "Douala", wallet: { create: { balance } } },
  });
  let sub = null;
  if (subscription) {
    const p = plan ?? (await createPlan({ adQuota }));
    sub = await prisma.subscription.create({
      data: { storeId: store.id, planId: p.id, status: "ACTIVE", adsUsed: 0, startsAt: new Date(), expiresAt: expiresAt ?? new Date(Date.now() + 30 * DAY_MS) },
    });
  }
  return { store, subscription: sub };
}

async function createCategory({ name = `Category ${uid()}`, parentId = null } = {}) {
  return prisma.category.create({ data: { name, slug: `cat-${uid()}`, parentId } });
}

async function createListing(storeId, categoryId, { status = "PUBLISHED", price = 10000, title, images = ["https://example.com/photo.jpg"], featuredUntil = null, compareAtPrice = null } = {}) {
  return prisma.advertisement.create({
    data: { storeId, categoryId, title: title ?? `Listing ${uid()}`, slug: `listing-${uid()}`, description: "A test listing description.", price, compareAtPrice, condition: "NEW", images, status, featuredUntil, featuredAt: featuredUntil ? new Date() : null },
  });
}

/** An order that already went through Mobile Money: PAID with a COMPLETED payment and HELD escrow. */
async function createPaidOrder(buyerId, advertisement, { quantity = 1 } = {}) {
  const amount = Number(advertisement.price) * quantity;
  return prisma.order.create({
    data: {
      buyerId,
      advertisementId: advertisement.id,
      quantity,
      totalAmount: amount,
      status: "PAID",
      payment: { create: { amount, provider: "KPAY", operator: "MTN_MOMO_CMR", phoneNumber: "237690000000", externalId: `order-${uid()}`, status: "COMPLETED", completedAt: new Date() } },
      escrow: { create: { amount, status: "HELD" } },
    },
    include: { payment: true, escrow: true },
  });
}

async function login(email, password = "Passw0rd123") {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${res.text}`);
  return { token: res.body.accessToken, cookie: res.headers["set-cookie"], user: res.body.user };
}

/** `as(token).get("/api/...")` — supertest with the bearer token attached. */
const as = (token) =>
  new Proxy(
    {},
    { get: (_, method) => (url) => request(app)[method](url).set("Authorization", `Bearer ${token}`) }
  );

/** Retries an assertion for fire-and-forget side effects (notifications are written asynchronously). */
async function eventually(check, { timeoutMs = 3000, everyMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  for (;;) {
    try {
      return await check();
    } catch (err) {
      lastError = err;
      if (Date.now() > deadline) throw lastError;
      await new Promise((r) => setTimeout(r, everyMs));
    }
  }
}

/** Resolves true once the shared Redis client is usable, false if it is not within `ms`. */
function waitForRedis(ms = 3000) {
  if (redis.status === "ready") return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    redis.once("ready", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

const signWebhook = (body) => crypto.createHmac("sha256", process.env.KPAY_WEBHOOK_SECRET).update(body).digest("hex");

module.exports = { app, prisma, redis, request, resetDb, teardown, eventually, waitForRedis, createUser, createPlan, createStore, createCategory, createListing, createPaidOrder, login, as, signWebhook, uid, DAY_MS };
