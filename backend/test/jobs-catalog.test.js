const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, redis, request, resetDb, teardown, createUser, createStore, createCategory, createListing, createPaidOrder, uid, DAY_MS } = require("./helpers");
const jobs = require("../src/jobs");

describe("background jobs", () => {
  before(resetDb);
  after(teardown);

  test("subscription-expiry expires overdue plans, notifies the owner once, and sends one renewal notice", async () => {
    const { user: owner } = await createUser();
    const { store, subscription } = await createStore(owner.id, { expiresAt: new Date(Date.now() - DAY_MS) });
    await createListing(store.id, (await createCategory()).id);
    const { user: owner2 } = await createUser();
    const { subscription: soon } = await createStore(owner2.id, { expiresAt: new Date(Date.now() + 2 * DAY_MS) });

    const run1 = await jobs.run("subscription-expiry", { trigger: "manual" });
    assert.equal(run1.ok, true, run1.error);
    assert.equal(run1.summary.expired, 1);
    assert.equal(run1.summary.renewalNotices, 1);
    assert.equal((await prisma.subscription.findUnique({ where: { id: subscription.id } })).status, "EXPIRED");
    assert.ok((await prisma.subscription.findUnique({ where: { id: soon.id } })).expiryNoticeSentAt);

    const expiredNote = await prisma.notification.findFirst({ where: { userId: owner.id, type: "SUBSCRIPTION_EXPIRED" } });
    assert.ok(expiredNote);
    assert.equal(expiredNote.data.count, 1, "tells the seller one listing went invisible");
    assert.ok(await prisma.notification.findFirst({ where: { userId: owner.id, type: "ADVERTISEMENT_EXPIRED" } }));
    assert.ok(await prisma.notification.findFirst({ where: { userId: owner2.id, type: "SUBSCRIPTION_EXPIRING" } }));

    const run2 = await jobs.run("subscription-expiry", { trigger: "manual" });
    assert.equal(run2.summary.expired, 0);
    assert.equal(run2.summary.renewalNotices, 0, "the renewal notice is sent only once");
  });

  test("stale-payments cancels an abandoned payment and its subscription checkout", async () => {
    const { user: buyer } = await createUser();
    const { user: owner } = await createUser();
    const { store } = await createStore(owner.id);
    const ad = await createListing(store.id, (await createCategory()).id);
    const order = await prisma.order.create({ data: { buyerId: buyer.id, advertisementId: ad.id, quantity: 1, totalAmount: 1000, status: "PENDING_PAYMENT" } });
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await prisma.payment.create({ data: { orderId: order.id, amount: 1000, externalId: `order-${uid()}`, provider: "KPAY", phoneNumber: "237690000000", status: "PENDING", createdAt: old } });
    const plan = await prisma.subscriptionPlan.findFirst();
    const pendingSub = await prisma.subscription.create({ data: { storeId: store.id, planId: plan.id, status: "PENDING_PAYMENT" } });
    await prisma.payment.create({ data: { subscriptionId: pendingSub.id, amount: 5000, externalId: `sub-${uid()}`, provider: "KPAY", phoneNumber: "237690000000", status: "PENDING", createdAt: old } });
    const fresh = await prisma.payment.create({ data: { amount: 10, externalId: `fresh-${uid()}`, provider: "KPAY", status: "PENDING" } });

    const run = await jobs.run("stale-payments", { trigger: "manual" });
    assert.equal(run.ok, true, run.error);
    assert.equal(run.summary.expired, 2);
    assert.equal(run.summary.cancelledSubscriptions, 1);
    assert.equal((await prisma.payment.findUnique({ where: { orderId: order.id } })).status, "CANCELLED");
    assert.equal((await prisma.subscription.findUnique({ where: { id: pendingSub.id } })).status, "CANCELLED");
    assert.equal((await prisma.payment.findUnique({ where: { id: fresh.id } })).status, "PENDING", "recent payments are left alone");
  });

  test("audit-retention deletes only rows older than the retention window", async () => {
    process.env.AUDIT_LOG_RETENTION_DAYS = "30";
    await prisma.auditLog.createMany({
      data: [
        { action: "OLD", createdAt: new Date(Date.now() - 40 * DAY_MS) },
        { action: "OLD", createdAt: new Date(Date.now() - 31 * DAY_MS) },
        { action: "RECENT", createdAt: new Date(Date.now() - 5 * DAY_MS) },
      ],
    });
    const run = await jobs.run("audit-retention", { trigger: "manual" });
    assert.equal(run.ok, true, run.error);
    assert.equal(run.summary.deleted, 2);
    assert.equal(await prisma.auditLog.count({ where: { action: "OLD" } }), 0);
    assert.equal(await prisma.auditLog.count({ where: { action: "RECENT" } }), 1);
  });

  test("view-counts flushes batched Redis counters into the database", async (t) => {
    if (redis.status !== "ready") return t.skip("Redis not available");
    const { user: owner } = await createUser();
    const { store } = await createStore(owner.id);
    const ad = await createListing(store.id, (await createCategory()).id);
    for (let i = 0; i < 3; i += 1) await request(app).get(`/api/advertisements/${ad.slug}`);
    assert.equal((await prisma.advertisement.findUnique({ where: { id: ad.id } })).viewCount, 0, "no synchronous write per view");
    const run = await jobs.run("view-counts", { trigger: "manual" });
    assert.equal(run.ok, true, run.error);
    assert.equal((await prisma.advertisement.findUnique({ where: { id: ad.id } })).viewCount, 3);
  });

  test("the jobs list reports every registered job", async () => {
    const list = await jobs.list();
    assert.deepEqual(
      list.map((j) => j.name).sort(),
      ["audit-retention", "flash-campaigns", "payout-status", "stale-payments", "subscription-expiry", "view-counts"]
    );
  });
});

describe("public catalogue", () => {
  let category, child, store;

  before(async () => {
    await resetDb();
    const { user: owner } = await createUser();
    ({ store } = await createStore(owner.id));
    category = await createCategory({ name: "Electronics" });
    child = await createCategory({ name: "Phones", parentId: category.id });
    await createListing(store.id, child.id, { title: "Galaxy phone", price: 90000 });
    await createListing(store.id, category.id, { title: "Bluetooth speaker", price: 15000, compareAtPrice: 20000 });
    await createListing(store.id, category.id, { title: "Hidden draft", status: "DRAFT" });
    await createListing(store.id, category.id, { title: "Featured lamp", price: 5000, featuredUntil: new Date(Date.now() + DAY_MS) });
    const { user: suspendedOwner } = await createUser();
    const { store: suspended } = await createStore(suspendedOwner.id, { status: "SUSPENDED" });
    await createListing(suspended.id, category.id, { title: "From a suspended store" });
  });
  after(teardown);

  test("only published listings of active, subscribed stores are listed", async () => {
    const res = await request(app).get("/api/advertisements?pageSize=50");
    assert.equal(res.status, 200);
    const titles = res.body.items.map((i) => i.title).sort();
    assert.deepEqual(titles, ["Bluetooth speaker", "Featured lamp", "Galaxy phone"]);
    assert.equal(res.body.total, 3);
  });

  test("search, deals, price filters and category roll-up", async () => {
    assert.deepEqual((await request(app).get("/api/advertisements?search=galaxy")).body.items.map((i) => i.title), ["Galaxy phone"]);
    assert.deepEqual((await request(app).get("/api/advertisements?deals=true")).body.items.map((i) => i.title), ["Bluetooth speaker"]);
    assert.deepEqual((await request(app).get("/api/advertisements?maxPrice=10000")).body.items.map((i) => i.title), ["Featured lamp"]);
    const rolled = await request(app).get(`/api/advertisements?categorySlug=${category.slug}&pageSize=50`);
    assert.equal(rolled.body.total, 3, "a parent category includes its children's listings");
    const onlyChild = await request(app).get(`/api/advertisements?categorySlug=${child.slug}`);
    assert.equal(onlyChild.body.total, 1);
  });

  test("hero rail returns only currently featured listings", async () => {
    const res = await request(app).get("/api/advertisements/hero");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.items.map((i) => i.title), ["Featured lamp"]);
  });

  test("category counts roll children up into the parent", async () => {
    const res = await request(app).get("/api/categories?withCounts=true&pageSize=100");
    assert.equal(res.status, 200);
    const parent = res.body.items.find((c) => c.id === category.id);
    const phones = res.body.items.find((c) => c.id === child.id);
    assert.equal(parent.productCount, 3);
    assert.equal(phones.productCount, 1);
  });

  test("a store's public page hides suspended stores", async () => {
    assert.equal((await request(app).get(`/api/stores/${store.slug}`)).status, 200);
    const suspended = await prisma.store.findFirst({ where: { status: "SUSPENDED" } });
    assert.equal((await request(app).get(`/api/stores/${suspended.slug}`)).status, 404);
  });

  test("a buyer's completed order can be reviewed once and the store rating follows", async () => {
    const { user: buyer } = await createUser();
    const session = await require("./helpers").login(buyer.email);
    const ad = await prisma.advertisement.findFirst({ where: { title: "Galaxy phone" } });
    const order = await createPaidOrder(buyer.id, ad);
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status: "COMPLETED", sellerConfirmedAt: new Date(), buyerConfirmedAt: new Date() } }),
      prisma.escrowTransaction.update({ where: { orderId: order.id }, data: { status: "RELEASED", releasedAt: new Date() } }),
    ]);
    const { as } = require("./helpers");
    const review = await as(session.token).post(`/api/orders/${order.id}/review`).send({ rating: 4, comment: "Solid phone." });
    assert.equal(review.status, 201, review.text);
    const again = await as(session.token).post(`/api/orders/${order.id}/review`).send({ rating: 5 });
    assert.ok(again.status >= 400);
    const page = await request(app).get(`/api/stores/${store.slug}`);
    assert.equal(page.body.store.rating, 4);
    assert.equal(page.body.store.reviewCount, 1);
  });
});

describe("platform endpoints", () => {
  before(resetDb);
  after(teardown);

  test("health reports the database and echoes a request id on errors", async () => {
    const health = await request(app).get("/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.checks.database, "ok");
    assert.equal((await request(app).get("/api/health/live")).body.status, "ok");
    const missing = await request(app).get("/api/does-not-exist").set("x-request-id", "trace-123");
    assert.equal(missing.status, 404);
    assert.equal(missing.headers["x-request-id"], "trace-123");
  });

  test("the assistant is offline without a model key and validates its input", async () => {
    assert.deepEqual((await request(app).get("/api/assistant/status")).body, { enabled: false });
    const off = await request(app).post("/api/assistant/chat").send({ messages: [{ role: "user", content: "hello" }], locale: "en" });
    assert.equal(off.status, 503);
    assert.equal(off.body.code, "ASSISTANT_UNAVAILABLE");
    const bad = await request(app).post("/api/assistant/chat").send({ messages: [{ role: "assistant", content: "hi" }] });
    assert.equal(bad.status, 422);
  });

  test("contact messages are stored and staff can mark them handled", async () => {
    const sent = await request(app).post("/api/support/contact").send({ name: "Ada", email: "ada@test.dev", subject: "Hello", message: "Just checking the inbox works end to end." });
    assert.equal(sent.status, 201);
    const { user: staff } = await createUser({ role: "CUSTOMER_SERVICE" });
    const { token } = await require("./helpers").login(staff.email);
    const { as } = require("./helpers");
    const inbox = await as(token).get("/api/support/messages?unhandled=true");
    assert.equal(inbox.body.total, 1);
    const handled = await as(token).patch(`/api/support/messages/${inbox.body.items[0].id}/handled`).send({ handled: true });
    assert.ok(handled.body.message.handledAt);
    assert.equal((await as(token).get("/api/support/messages?unhandled=true")).body.total, 0);
  });
});
