const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
// helpers first: it loads test/bootstrap.js, which points the app at the *_test database.
const { app, prisma, request, resetDb, teardown, eventually, createUser, createPlan, createCategory, createListing, login, as } = require("./helpers");

describe("new stores wait for staff approval", () => {
  let seller, other, accountant, cs, admin, customer, category, plan;

  before(async () => {
    await resetDb();
    const [s, o, acc, c, sa, cu] = await Promise.all([
      createUser(),
      createUser(),
      createUser({ role: "ACCOUNTANT" }),
      createUser({ role: "CUSTOMER_SERVICE" }),
      createUser({ role: "SUPER_ADMIN" }),
      createUser(),
    ]);
    seller = { ...s, ...(await login(s.user.email)) };
    other = { ...o, ...(await login(o.user.email)) };
    accountant = { ...acc, ...(await login(acc.user.email)) };
    cs = { ...c, ...(await login(c.user.email)) };
    admin = { ...sa, ...(await login(sa.user.email)) };
    customer = { ...cu, ...(await login(cu.user.email)) };
    category = await createCategory();
    plan = await createPlan({ adQuota: 5 });
  });
  after(teardown);

  test("opening a store creates it PENDING, hides it and alerts every staff member", async () => {
    const res = await as(seller.token).post("/api/stores").send({ name: "Pending Pixels", location: "Douala" });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.store.status, "PENDING");
    seller.store = res.body.store;

    assert.equal((await request(app).get(`/api/stores/${seller.store.slug}`)).status, 404, "not public while pending");
    const me = await as(seller.token).get("/api/users/me");
    assert.equal(me.body.user.store.status, "PENDING", "the seller's session knows the store is pending");

    await eventually(async () => {
      const alerts = await prisma.notification.findMany({ where: { type: "STORE_SUBMITTED" } });
      const alerted = new Set(alerts.map((n) => n.userId));
      for (const staff of [accountant, cs, admin]) assert.ok(alerted.has(staff.user.id), "each staff member is alerted");
      assert.ok(!alerted.has(customer.user.id), "customers are not");
    });
  });

  test("a pending store can prepare drafts but cannot buy a plan or publish", async () => {
    const sub = await as(seller.token).post("/api/subscriptions/checkout").send({ planId: plan.id, provider: "MTN_MOMO_CMR", phoneNumber: "237690000001" });
    assert.equal(sub.status, 409);
    assert.equal(sub.body.code, "STORE_PENDING_APPROVAL");

    const draft = await createListing(seller.store.id, category.id, { title: "Draft lamp", status: "DRAFT" });
    const publish = await as(seller.token).post(`/api/advertisements/${draft.id}/publish`);
    assert.equal(publish.status, 409);
    assert.equal(publish.body.code, "STORE_PENDING_APPROVAL");
  });

  test("customers and sellers cannot review stores", async () => {
    assert.equal((await as(customer.token).post(`/api/stores/${seller.store.id}/approve`)).status, 403);
    assert.equal((await as(other.token).post(`/api/stores/${seller.store.id}/reject`).send({ reason: "Nope nope" })).status, 403);
  });

  test("an accountant approves: the store goes live and the seller is notified", async () => {
    const res = await as(accountant.token).post(`/api/stores/${seller.store.id}/approve`);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.store.status, "ACTIVE");
    assert.equal(res.body.store.reviewedById, accountant.user.id);
    assert.equal((await request(app).get(`/api/stores/${seller.store.slug}`)).status, 200);
    await eventually(async () => assert.ok(await prisma.notification.findFirst({ where: { userId: seller.user.id, type: "STORE_APPROVED" } })));
    assert.ok(await prisma.auditLog.findFirst({ where: { action: "STORE_APPROVED", entityId: seller.store.id } }));

    const again = await as(admin.token).post(`/api/stores/${seller.store.id}/approve`);
    assert.equal(again.status, 409);
    assert.equal(again.body.code, "STORE_ALREADY_ACTIVE");

    const sub = await as(seller.token).post("/api/subscriptions/checkout").send({ planId: plan.id, provider: "MTN_MOMO_CMR", phoneNumber: "237690000001" });
    assert.notEqual(sub.body.code, "STORE_PENDING_APPROVAL", "plans are open once approved");
  });

  test("customer service rejects with a reason the seller can read", async () => {
    const created = await as(other.token).post("/api/stores").send({ name: "Mystery Box" });
    assert.equal(created.status, 201);
    const noReason = await as(cs.token).post(`/api/stores/${created.body.store.id}/reject`).send({ reason: "" });
    assert.equal(noReason.status, 422);

    const res = await as(cs.token).post(`/api/stores/${created.body.store.id}/reject`).send({ reason: "Please add a real location and a logo." });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.store.status, "SUSPENDED");
    assert.equal(res.body.store.reviewNote, "Please add a real location and a logo.");
    await eventually(async () => {
      const n = await prisma.notification.findFirst({ where: { userId: other.user.id, type: "STORE_REJECTED" } });
      assert.ok(n);
      assert.equal(n.data.reviewNote, "Please add a real location and a logo.");
    });
    const me = await as(other.token).get("/api/users/me");
    assert.equal(me.body.user.store.reviewNote, "Please add a real location and a logo.");

    const rejectAgain = await as(cs.token).post(`/api/stores/${created.body.store.id}/reject`).send({ reason: "Still missing details" });
    assert.equal(rejectAgain.status, 409, "only pending stores can be rejected");
    const approveLater = await as(admin.token).post(`/api/stores/${created.body.store.id}/approve`);
    assert.equal(approveLater.status, 200, "a rejected store can be approved once fixed");
  });
});
