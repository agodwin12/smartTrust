const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { prisma, resetDb, teardown, createUser, login, as } = require("./helpers");

describe("roles and permissions", () => {
  let sa, acc, cs, customer;

  before(async () => {
    await resetDb();
    const [a, b, c, d] = await Promise.all([
      createUser({ role: "SUPER_ADMIN" }),
      createUser({ role: "ACCOUNTANT" }),
      createUser({ role: "CUSTOMER_SERVICE" }),
      createUser({ role: "CUSTOMER" }),
    ]);
    sa = { ...a, ...(await login(a.user.email)) };
    acc = { ...b, ...(await login(b.user.email)) };
    cs = { ...c, ...(await login(c.user.email)) };
    customer = { ...d, ...(await login(d.user.email)) };
  });
  after(teardown);

  test("customers cannot reach staff endpoints", async () => {
    for (const url of ["/api/admin/stats", "/api/users", "/api/orders", "/api/disputes", "/api/audit-logs", "/api/stores/all", "/api/advertisements/all"]) {
      const res = await as(customer.token).get(url);
      assert.equal(res.status, 403, url);
    }
  });

  test("money endpoints are finance-only: customer service is refused, accountant and super admin allowed", async () => {
    for (const url of ["/api/payments", "/api/withdrawals", "/api/refunds"]) {
      assert.equal((await as(cs.token).get(url)).status, 403, `CS ${url}`);
      assert.equal((await as(acc.token).get(url)).status, 200, `ACC ${url}`);
      assert.equal((await as(sa.token).get(url)).status, 200, `SA ${url}`);
    }
  });

  test("only a super admin can create staff or change roles", async () => {
    const body = { email: "staff-new@test.dev", password: "Passw0rd123", firstName: "New", lastName: "Staff", role: "CUSTOMER_SERVICE" };
    assert.equal((await as(acc.token).post("/api/users/staff").send(body)).status, 403);
    assert.equal((await as(cs.token).post("/api/users/staff").send(body)).status, 403);
    const created = await as(sa.token).post("/api/users/staff").send(body);
    assert.equal(created.status, 201);
    assert.equal(created.body.user.role, "CUSTOMER_SERVICE");

    assert.equal((await as(cs.token).patch(`/api/users/${customer.user.id}/role`).send({ role: "ACCOUNTANT" })).status, 403);
    const promoted = await as(sa.token).patch(`/api/users/${customer.user.id}/role`).send({ role: "ACCOUNTANT" });
    assert.equal(promoted.status, 200);
    assert.equal(promoted.body.user.role, "ACCOUNTANT");
  });

  test("customer service can suspend a customer but not the super admin, and nobody can act on themselves", async () => {
    const { user: target } = await createUser();
    const ok = await as(cs.token).patch(`/api/users/${target.id}/status`).send({ status: "SUSPENDED" });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.status, "SUSPENDED");

    const escalation = await as(cs.token).patch(`/api/users/${sa.user.id}/status`).send({ status: "SUSPENDED" });
    assert.equal(escalation.status, 403);
    assert.equal(escalation.body.code, "INSUFFICIENT_RANK");

    const self = await as(sa.token).patch(`/api/users/${sa.user.id}/status`).send({ status: "SUSPENDED" });
    assert.equal(self.status, 422);
    assert.equal(self.body.code, "CANNOT_ACT_ON_SELF");
  });

  test("a super admin cannot suspend a peer (strict outranking) but can change a peer's role, never their own", async () => {
    const { user: second } = await createUser({ role: "SUPER_ADMIN" });
    const suspend = await as(sa.token).patch(`/api/users/${second.id}/status`).send({ status: "SUSPENDED" });
    assert.equal(suspend.status, 403);
    assert.equal(suspend.body.code, "INSUFFICIENT_RANK");

    const demote = await as(sa.token).patch(`/api/users/${second.id}/role`).send({ role: "CUSTOMER" });
    assert.equal(demote.status, 200);
    assert.equal((await prisma.user.findUnique({ where: { id: second.id } })).role, "CUSTOMER");

    const own = await as(sa.token).patch(`/api/users/${sa.user.id}/role`).send({ role: "CUSTOMER" });
    assert.equal(own.status, 422);
    assert.equal(own.body.code, "CANNOT_ACT_ON_SELF");
  });

  test("admin stats aggregate is served to staff", async () => {
    const res = await as(cs.token).get("/api/admin/stats");
    assert.equal(res.status, 200);
    assert.ok(typeof res.body.users.total === "number");
    assert.ok(res.body.orders && res.body.escrow);
  });
});
