const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
// helpers first: it loads test/bootstrap.js, which points the app at the *_test database.
const { app, prisma, request, resetDb, teardown, eventually, createUser, createPlan, createStore, createCategory, createListing, login, as, DAY_MS } = require("./helpers");
const jobs = require("../src/jobs");

const OFFER_END = new Date(Date.now() + 120 * DAY_MS);
const openOffer = () => (process.env.LAUNCH_OFFER_ENDS_AT = OFFER_END.toISOString());
const closeOffer = () => (process.env.LAUNCH_OFFER_ENDS_AT = new Date(Date.now() - 1000).toISOString());

describe("launch offer: selling is free until the offer ends", () => {
  let seller, admin, category, paidPlan;

  before(async () => {
    await resetDb();
    openOffer();
    const [s, sa] = await Promise.all([createUser(), createUser({ role: "SUPER_ADMIN" })]);
    seller = { ...s, ...(await login(s.user.email)) };
    admin = { ...sa, ...(await login(sa.user.email)) };
    category = await createCategory();
    paidPlan = await createPlan({ adQuota: 5 });
  });
  after(async () => {
    closeOffer();
    await teardown();
  });

  test("an approved store gets the free launch plan and publishes without paying", async () => {
    const created = await as(seller.token).post("/api/stores").send({ name: "Launch Day Store", location: "Buea" });
    assert.equal(created.status, 201, created.text);
    const draft = await as(seller.token).post("/api/advertisements").send({
      title: "Free launch listing",
      description: "Published during the launch offer without any plan.",
      price: 15000,
      categoryId: category.id,
      condition: "NEW",
    });
    assert.equal(draft.status, 201, draft.text);

    assert.equal((await as(admin.token).post(`/api/stores/${created.body.store.id}/approve`)).status, 200);

    const mine = await as(seller.token).get("/api/subscriptions/me");
    assert.equal(mine.body.subscription.status, "ACTIVE");
    assert.equal(mine.body.subscription.plan.isLaunchOffer, true);
    assert.equal(Number(mine.body.subscription.plan.price), 0);
    assert.equal(new Date(mine.body.subscription.expiresAt).toISOString(), OFFER_END.toISOString(), "free until the offer ends");

    const publish = await as(seller.token).post(`/api/advertisements/${draft.body.advertisement.id}/publish`);
    assert.equal(publish.status, 200, publish.text);
    const detail = await request(app).get(`/api/advertisements/${draft.body.advertisement.slug}`);
    assert.equal(detail.status, 200, "the listing is on the marketplace");

    await eventually(async () => {
      const note = await prisma.notification.findFirst({ where: { userId: seller.user.id, type: "SUBSCRIPTION_ACTIVATED" } });
      assert.ok(note, "the seller is told");
      assert.equal(note.data.launchOffer, true);
    });
  });

  test("the launch plan is never listed or sold, and the pricing says until when it runs", async () => {
    const res = await request(app).get("/api/subscription-plans");
    assert.equal(res.status, 200);
    assert.ok(res.body.plans.every((p) => !p.isLaunchOffer), "hidden from the public pricing");
    assert.deepEqual(res.body.launchOffer, { open: true, endsAt: OFFER_END.toISOString() });

    const launchPlan = await prisma.subscriptionPlan.findFirst({ where: { isLaunchOffer: true } });
    const buy = await as(seller.token).post("/api/subscriptions/checkout").send({ planId: launchPlan.id, provider: "MTN_MOMO_CMR", phoneNumber: "237690000001" });
    assert.equal(buy.status, 404);

    // Staff can tune the quota, but the plan stays free and hidden.
    const edit = await as(admin.token).patch(`/api/subscription-plans/${launchPlan.id}`).send({ adQuota: 50, price: 9000, isActive: true });
    assert.equal(edit.status, 200, edit.text);
    assert.equal(edit.body.plan.adQuota, 50);
    assert.equal(Number(edit.body.plan.price), 0);
    assert.equal(edit.body.plan.isActive, false);
  });

  test("the job gives the offer to stores without a plan, including one whose paid plan just ran out", async () => {
    const { user: a } = await createUser();
    const { store: bare } = await createStore(a.id, { subscription: false });
    const { user: b } = await createUser();
    const { store: lapsed } = await createStore(b.id, { plan: paidPlan, expiresAt: new Date(Date.now() - 1000) });
    await createListing(lapsed.id, category.id);
    const { user: c } = await createUser();
    const { store: pending } = await createStore(c.id, { status: "PENDING", subscription: false });

    const run = await jobs.run("subscription-expiry", { trigger: "manual" });
    assert.equal(run.ok, true, run.error);

    for (const store of [bare, lapsed]) {
      const active = await prisma.subscription.findFirst({ where: { storeId: store.id, status: "ACTIVE" }, include: { plan: true } });
      assert.ok(active?.plan.isLaunchOffer, "covered by the launch offer");
    }
    const lapsedSub = await prisma.subscription.findFirst({ where: { storeId: lapsed.id, status: "ACTIVE" } });
    assert.equal(lapsedSub.adsUsed, 1, "listings already online count against the quota");
    assert.equal(await prisma.subscription.count({ where: { storeId: pending.id } }), 0, "stores awaiting approval get nothing yet");

    const again = await jobs.run("subscription-expiry", { trigger: "manual" });
    assert.equal(again.summary.launchOfferGranted, 0, "granted once");
  });

  test("once the offer ends, launch plans expire and plans are paid again", async () => {
    closeOffer();
    await jobs.run("subscription-expiry", { trigger: "manual" });
    assert.equal(await prisma.subscription.count({ where: { status: "ACTIVE", plan: { isLaunchOffer: true } } }), 0);

    const store = await prisma.store.findUnique({ where: { ownerId: seller.user.id } });
    const listings = await request(app).get(`/api/advertisements?storeId=${store.id}`);
    assert.equal(listings.body.items.length, 0, "listings leave the marketplace until the seller picks a plan");

    const pricing = await request(app).get("/api/subscription-plans");
    assert.equal(pricing.body.launchOffer.open, false);

    const { user } = await createUser();
    const { store: late } = await createStore(user.id, { status: "PENDING", subscription: false });
    const { user: staff } = await createUser({ role: "ACCOUNTANT" });
    const approve = await as((await login(staff.email)).token).post(`/api/stores/${late.id}/approve`);
    assert.equal(approve.status, 200);
    assert.equal(await prisma.subscription.count({ where: { storeId: late.id } }), 0, "no free plan after the offer");
  });
});
