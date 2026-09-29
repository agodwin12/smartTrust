const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
// helpers first: it loads test/bootstrap.js, which points the app at the *_test database.
const { app, prisma, request, resetDb, teardown, createUser, login } = require("./helpers");
const { safeUrl } = require("../src/middlewares/requestContext");

const refreshWith = (cookie) => request(app).post("/api/auth/refresh").set("Cookie", cookie);
const me = (token) => request(app).get("/api/users/me").set("Authorization", `Bearer ${token}`);

describe("sign-out ends every session", () => {
  let user;

  before(async () => {
    await resetDb();
    ({ user } = await createUser());
  });
  after(teardown);

  test("signing out on one device revokes every refresh token and every access token", async () => {
    const laptop = await login(user.email);
    const phone = await login(user.email);
    assert.equal((await me(laptop.token)).status, 200);
    assert.equal((await me(phone.token)).status, 200);

    const out = await request(app).post("/api/auth/logout").set("Cookie", laptop.cookie).set("Authorization", `Bearer ${laptop.token}`);
    assert.equal(out.status, 204);
    assert.match(String(out.headers["set-cookie"]), /Expires=Thu, 01 Jan 1970/, "the refresh cookie is cleared");

    for (const session of [laptop, phone]) {
      const stale = await me(session.token);
      assert.equal(stale.status, 401, "access tokens issued before sign-out stop working at once");
      assert.equal(stale.body.code, "TOKEN_REVOKED");
      assert.equal((await refreshWith(session.cookie)).status, 401, "refresh tokens are revoked on every device");
    }
    assert.equal(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } }), 0);
    const row = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(row.tokenVersion, 1);
    assert.ok(await prisma.auditLog.findFirst({ where: { action: "LOGOUT", actorId: user.id } }));
  });

  test("signing in again after sign-out works normally", async () => {
    const fresh = await login(user.email);
    assert.equal((await me(fresh.token)).status, 200);
    const renewed = await refreshWith(fresh.cookie);
    assert.equal(renewed.status, 200);
    assert.equal((await me(renewed.body.accessToken)).status, 200);
  });

  test("sign-out also works with only the refresh cookie, and is harmless without any credential", async () => {
    const session = await login(user.email);
    assert.equal((await request(app).post("/api/auth/logout").set("Cookie", session.cookie)).status, 204);
    assert.equal((await me(session.token)).status, 401);
    assert.equal((await request(app).post("/api/auth/logout")).status, 204);
  });

  test("secrets in URLs never reach the request log", () => {
    assert.equal(safeUrl("/api/checkout/abc?token=s3cr3t&x=1"), "/api/checkout/abc?token=[redacted]&x=1");
    assert.equal(safeUrl("/api/auth/google/callback?code=4/abc&state=xyz"), "/api/auth/google/callback?code=[redacted]&state=[redacted]");
    assert.equal(safeUrl("/api/advertisements?search=phone"), "/api/advertisements?search=phone");
  });
});
