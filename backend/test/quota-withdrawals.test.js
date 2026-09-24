const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { prisma, resetDb, teardown, createUser, createStore, createCategory, createListing, login, as, signWebhook, request, app } = require("./helpers");
const advertisementService = require("../src/services/advertisement.service");
const kpayService = require("../src/services/kpay.service");

describe("subscription quota", () => {
  let seller, store, category;

  before(async () => {
    await resetDb();
    const s = await createUser();
    seller = { ...s, ...(await login(s.user.email)) };
    ({ store } = await createStore(seller.user.id, { adQuota: 2 }));
    category = await createCategory();
  });
  after(teardown);

  test("publishing stops at the plan quota", async () => {
    const drafts = await Promise.all([0, 1, 2].map(() => createListing(store.id, category.id, { status: "DRAFT" })));
    assert.equal((await as(seller.token).post(`/api/advertisements/${drafts[0].id}/publish`)).status, 200);
    assert.equal((await as(seller.token).post(`/api/advertisements/${drafts[1].id}/publish`)).status, 200);
    const third = await as(seller.token).post(`/api/advertisements/${drafts[2].id}/publish`);
    assert.equal(third.status, 422);
    const sub = await prisma.subscription.findFirst({ where: { storeId: store.id } });
    assert.equal(sub.adsUsed, 2);
  });

  test("two publishes racing for the last slot: exactly one wins", async () => {
    const { user } = await createUser();
    const { store: fresh, subscription } = await createStore(user.id, { adQuota: 1 });
    const [a, b] = await Promise.all([createListing(fresh.id, category.id, { status: "DRAFT" }), createListing(fresh.id, category.id, { status: "DRAFT" })]);
    const results = await Promise.allSettled([advertisementService.publish(a.id, fresh.id), advertisementService.publish(b.id, fresh.id)]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    assert.equal((await prisma.subscription.findUnique({ where: { id: subscription.id } })).adsUsed, 1);
    assert.equal(await prisma.advertisement.count({ where: { storeId: fresh.id, status: "PUBLISHED" } }), 1);
  });

  test("without an active subscription nothing can be published", async () => {
    const { user } = await createUser();
    const { store: noPlan } = await createStore(user.id, { subscription: false });
    const draft = await createListing(noPlan.id, category.id, { status: "DRAFT" });
    await assert.rejects(advertisementService.publish(draft.id, noPlan.id), (err) => err.code === "NO_ACTIVE_SUBSCRIPTION");
  });
});

describe("withdrawals", () => {
  let seller, store;
  const original = kpayService.initWithdrawal;

  before(async () => {
    await resetDb();
    const s = await createUser();
    seller = { ...s, ...(await login(s.user.email)) };
    ({ store } = await createStore(seller.user.id, { balance: 1000 }));
    // The provider is unreachable in tests; pretend it accepted the payout.
    kpayService.initWithdrawal = async () => ({ id: `wdr_${Date.now()}`, reference: "KPAY-WD-TEST", status: "PROCESSING" });
  });
  after(async () => {
    kpayService.initWithdrawal = original;
    await teardown();
  });

  const balance = async () => Number((await prisma.wallet.findUnique({ where: { storeId: store.id } })).balance);
  const body = (amount) => ({ provider: "MTN_MOMO_CMR", phoneNumber: "237690000000", amount });

  test("a withdrawal reserves the amount; an amount above the balance is refused", async () => {
    const ok = await as(seller.token).post("/api/withdrawals").send(body(600));
    assert.equal(ok.status, 201, ok.text);
    assert.equal(ok.body.withdrawal.status, "PROCESSING");
    assert.equal(await balance(), 400);

    const tooMuch = await as(seller.token).post("/api/withdrawals").send(body(600));
    assert.equal(tooMuch.status, 422);
    assert.equal(tooMuch.body.code, "INSUFFICIENT_BALANCE");
    assert.equal(await balance(), 400);

    const belowMinimum = await as(seller.token).post("/api/withdrawals").send(body(50));
    assert.equal(belowMinimum.status, 422);
  });

  test("two concurrent withdrawals cannot both spend the same balance", async () => {
    await prisma.wallet.update({ where: { storeId: store.id }, data: { balance: 1000 } });
    const results = await Promise.all([as(seller.token).post("/api/withdrawals").send(body(800)), as(seller.token).post("/api/withdrawals").send(body(800))]);
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 422]);
    assert.equal(await balance(), 200);
  });

  test("a payout the provider rejects gives the reservation back", async () => {
    await prisma.wallet.update({ where: { storeId: store.id }, data: { balance: 500 } });
    kpayService.initWithdrawal = async () => {
      throw new Error("La plateforme est en maintenance");
    };
    const res = await as(seller.token).post("/api/withdrawals").send(body(300));
    assert.ok(res.status >= 400);
    assert.equal(await balance(), 500);
    kpayService.initWithdrawal = async () => ({ id: "wdr_ok", reference: "KPAY-WD-OK", status: "PROCESSING" });
  });

  test("a FAILED payout reported by the webhook credits the wallet back exactly once", async () => {
    await prisma.wallet.update({ where: { storeId: store.id }, data: { balance: 500 } });
    const res = await as(seller.token).post("/api/withdrawals").send(body(300));
    assert.equal(res.status, 201);
    assert.equal(await balance(), 200);
    const payload = JSON.stringify({ event: "payout.failed", payoutId: res.body.withdrawal.providerPayoutId, externalId: res.body.withdrawal.externalId, status: "FAILED", failureReason: "Beneficiary not found" });
    for (let i = 0; i < 2; i += 1) {
      const hook = await request(app).post("/api/payments/webhooks/kpay").set("Content-Type", "application/json").set("X-KPAY-Signature", signWebhook(payload)).send(payload);
      assert.equal(hook.status, 200);
    }
    assert.equal(await balance(), 500);
    const w = await prisma.withdrawal.findUnique({ where: { id: res.body.withdrawal.id } });
    assert.equal(w.status, "FAILED");
    assert.equal(w.failureReason, "Beneficiary not found");
  });
});
