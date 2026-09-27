const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
// helpers first: it loads test/bootstrap.js, which points the app at the *_test database.
const { prisma, resetDb, teardown, createUser, login, as } = require("./helpers");

describe("Super Admin creates staff accounts", () => {
  let admin, cs, existing;

  before(async () => {
    await resetDb();
    const [sa, c] = await Promise.all([createUser({ role: "SUPER_ADMIN" }), createUser({ role: "CUSTOMER_SERVICE" })]);
    admin = { ...sa, ...(await login(sa.user.email)) };
    cs = { ...c, ...(await login(c.user.email)) };
    ({ user: existing } = await createUser({ email: "taken@example.com" }));
    await prisma.user.update({ where: { id: existing.id }, data: { phone: "+237690000999" } });
  });
  after(teardown);

  const body = (extra = {}) => ({ firstName: "Nadia", lastName: "Mbu", email: "nadia.staff@example.com", password: "Staff2026", role: "ACCOUNTANT", ...extra });

  test("the API explains exactly what is wrong", async () => {
    const weak = await as(admin.token).post("/api/users/staff").send(body({ password: "12345678" }));
    assert.equal(weak.status, 422);
    assert.equal(weak.body.code, "VALIDATION_ERROR");
    assert.match(weak.body.error, /at least one letter/);

    const email = await as(admin.token).post("/api/users/staff").send(body({ email: "taken@example.com" }));
    assert.equal(email.status, 409);
    assert.equal(email.body.code, "EMAIL_IN_USE");
    assert.match(email.body.error, /change their role/);

    const phone = await as(admin.token).post("/api/users/staff").send(body({ phone: "+237690000999" }));
    assert.equal(phone.status, 409);
    assert.equal(phone.body.code, "PHONE_IN_USE");
  });

  test("only the Super Admin can create staff, and the account works right away", async () => {
    assert.equal((await as(cs.token).post("/api/users/staff").send(body())).status, 403);
    const res = await as(admin.token).post("/api/users/staff").send(body());
    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.user.role, "ACCOUNTANT");
    assert.ok(res.body.user.emailVerifiedAt, "staff do not go through the email code step");
    const staff = await login("nadia.staff@example.com", "Staff2026");
    assert.ok(staff.token);
  });
});
