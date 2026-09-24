const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
// helpers first: it loads test/bootstrap.js, which points the app at the *_test database.
const { app, prisma, request, resetDb, teardown, eventually, createUser, createStore, createCategory, createListing, login, as } = require("./helpers");
const flashService = require("../src/services/flashCampaign.service");

const HOUR = 60 * 60 * 1000;
const iso = (ms) => new Date(Date.now() + ms).toISOString();

describe("flash-deal campaigns", () => {
  let admin, accountant, seller, store, category, listing, other;

  before(async () => {
    await resetDb();
    const [a, acc, s, o] = await Promise.all([
      createUser({ role: "SUPER_ADMIN" }),
      createUser({ role: "ACCOUNTANT" }),
      createUser(),
      createUser(),
    ]);
    admin = { ...a, ...(await login(a.user.email)) };
    accountant = { ...acc, ...(await login(acc.user.email)) };
    seller = { ...s, ...(await login(s.user.email)) };
    other = { ...o, ...(await login(o.user.email)) };
    ({ store } = await createStore(seller.user.id));
    category = await createCategory();
    listing = await createListing(store.id, category.id, { title: "Flash test blender", price: 20000 });
  });
  after(teardown);

  const price = async (id) => Number((await prisma.advertisement.findUnique({ where: { id } })).price);

  test("only operations staff can create campaigns; drafts are invisible to the public", async () => {
    const forbidden = await as(accountant.token).post("/api/flash-campaigns").send({ name: "Nope", startsAt: iso(HOUR), endsAt: iso(2 * HOUR) });
    assert.equal(forbidden.status, 403);

    const bad = await as(admin.token).post("/api/flash-campaigns").send({ name: "Backwards", startsAt: iso(2 * HOUR), endsAt: iso(HOUR) });
    assert.equal(bad.status, 422);

    const res = await as(admin.token).post("/api/flash-campaigns").send({ name: "Weekend Flash", description: "Big weekend", startsAt: iso(HOUR), endsAt: iso(3 * HOUR), minDiscountPercent: 15 });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.campaign.status, "DRAFT");
    assert.equal(res.body.campaign.phase, "DRAFT");

    const pub = await request(app).get("/api/flash-campaigns/upcoming");
    assert.equal(pub.body.campaign, null);
  });

  test("sellers apply to a published campaign and the discount rule is enforced", async () => {
    const { body } = await as(admin.token).post("/api/flash-campaigns").send({ name: "Seller Flash", startsAt: iso(HOUR), endsAt: iso(3 * HOUR), minDiscountPercent: 15 });
    const id = body.campaign.id;

    const closed = await as(seller.token).post(`/api/flash-campaigns/${id}/applications`).send({ advertisementId: listing.id, campaignPrice: 15000 });
    assert.equal(closed.status, 409, "a draft does not take applications");

    const published = await as(admin.token).post(`/api/flash-campaigns/${id}/publish`);
    assert.equal(published.status, 200, published.text);
    assert.equal(published.body.campaign.phase, "SCHEDULED");
    const upcoming = await request(app).get("/api/flash-campaigns/upcoming");
    assert.equal(upcoming.body.campaign.id, id);

    const tooSmall = await as(seller.token).post(`/api/flash-campaigns/${id}/applications`).send({ advertisementId: listing.id, campaignPrice: 19000 });
    assert.equal(tooSmall.status, 422);
    assert.equal(tooSmall.body.code, "FLASH_DISCOUNT_TOO_SMALL");

    const notMine = await as(other.token).post(`/api/flash-campaigns/${id}/applications`).send({ advertisementId: listing.id, campaignPrice: 15000 });
    assert.equal(notMine.status, 404, "a user without a store cannot apply");

    const ok = await as(seller.token).post(`/api/flash-campaigns/${id}/applications`).send({ advertisementId: listing.id, campaignPrice: 15000, note: "Overstock" });
    assert.equal(ok.status, 201, ok.text);
    assert.equal(ok.body.item.status, "PENDING");
    assert.equal(ok.body.item.discountPercent, 25);

    const dup = await as(seller.token).post(`/api/flash-campaigns/${id}/applications`).send({ advertisementId: listing.id, campaignPrice: 14000 });
    assert.equal(dup.status, 409);

    const open = await as(seller.token).get("/api/flash-campaigns/open");
    assert.equal(open.body.campaigns.find((c) => c.id === id).items.length, 1);

    const review = await as(admin.token).patch(`/api/flash-campaigns/${id}/items/${ok.body.item.id}`).send({ status: "APPROVED", reviewNote: "Great" });
    assert.equal(review.status, 200, review.text);
    assert.equal(review.body.item.status, "APPROVED");
    assert.equal(await price(listing.id), 20000, "prices do not move before the campaign starts");
    await eventually(async () => assert.ok(await prisma.notification.findFirst({ where: { userId: seller.user.id, type: "FLASH_APPLICATION_APPROVED" } })));

    const mine = await as(seller.token).get("/api/flash-campaigns/mine");
    assert.equal(mine.body.items[0].campaign.name, "Seller Flash");
  });

  test("the job applies campaign prices at start, locks seller price edits, and restores at the end", async () => {
    const listing2 = await createListing(store.id, category.id, { title: "Flash test lamp", price: 10000, compareAtPrice: 12000 });
    const { body } = await as(admin.token).post("/api/flash-campaigns").send({ name: "Live Now", startsAt: iso(-60 * 1000), endsAt: iso(HOUR), minDiscountPercent: 10 });
    const id = body.campaign.id;
    await as(admin.token).post(`/api/flash-campaigns/${id}/publish`);
    const added = await as(admin.token).post(`/api/flash-campaigns/${id}/items`).send({ advertisementId: listing2.id, campaignPrice: 8000 });
    assert.equal(added.status, 201, added.text);

    assert.equal(await flashService.activateDue(), 1);
    assert.equal(await flashService.activateDue(), 0, "activation happens once");

    const ad = await prisma.advertisement.findUnique({ where: { id: listing2.id } });
    assert.equal(Number(ad.price), 8000);
    assert.equal(Number(ad.compareAtPrice), 10000, "the old price becomes the was-price");

    const current = await request(app).get("/api/flash-campaigns/current");
    assert.equal(current.body.campaign.id, id);
    assert.equal(current.body.campaign.phase, "ACTIVE");
    assert.equal(current.body.campaign.items.length, 1);
    assert.equal(current.body.campaign.items[0].discountPercent, 20);
    assert.equal(current.body.campaign.items[0].advertisement.slug, listing2.slug);

    const locked = await as(seller.token).patch(`/api/advertisements/${listing2.id}`).send({ price: 9500 });
    assert.equal(locked.status, 409);
    assert.equal(locked.body.code, "FLASH_PRICE_LOCKED");
    const titleOnly = await as(seller.token).patch(`/api/advertisements/${listing2.id}`).send({ title: "Flash test lamp (gold)" });
    assert.equal(titleOnly.status, 200, "other fields stay editable");

    await eventually(async () => assert.ok(await prisma.notification.findFirst({ where: { userId: seller.user.id, type: "FLASH_CAMPAIGN_LIVE" } })));

    await prisma.flashCampaign.update({ where: { id }, data: { endsAt: new Date(Date.now() - 1000) } });
    assert.equal(await flashService.endDue(), 1);
    const restored = await prisma.advertisement.findUnique({ where: { id: listing2.id } });
    assert.equal(Number(restored.price), 10000);
    assert.equal(Number(restored.compareAtPrice), 12000, "the seller's own was-price comes back");
    const after = await request(app).get("/api/flash-campaigns/current");
    assert.equal(after.body.campaign, null);
  });

  test("cancelling a live campaign restores prices at once", async () => {
    const listing3 = await createListing(store.id, category.id, { title: "Flash test kettle", price: 30000 });
    const { body } = await as(admin.token).post("/api/flash-campaigns").send({ name: "Cancel Me", startsAt: iso(-60 * 1000), endsAt: iso(HOUR) });
    const id = body.campaign.id;
    await as(admin.token).post(`/api/flash-campaigns/${id}/publish`);
    await as(admin.token).post(`/api/flash-campaigns/${id}/items`).send({ advertisementId: listing3.id, campaignPrice: 24000 });
    await flashService.activateDue();
    assert.equal(await price(listing3.id), 24000);

    const cancelled = await as(admin.token).post(`/api/flash-campaigns/${id}/cancel`);
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.campaign.status, "CANCELLED");
    assert.equal(await price(listing3.id), 30000);
    const list = await as(admin.token).get("/api/flash-campaigns/admin?status=CANCELLED");
    assert.equal(list.body.items.length, 1);
  });
});
