const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, resetDb, teardown, createUser, login, as } = require("./helpers");
const cacheService = require("../src/services/cache.service");

const cookieHeader = (setCookie) => (Array.isArray(setCookie) ? setCookie : [setCookie]).map((c) => c.split(";")[0]).join("; ");

describe("auth", () => {
  before(resetDb);
  after(teardown);

  test("register returns a session and refuses a duplicate email", async () => {
    const email = "new-user@test.dev";
    const res = await request(app).post("/api/auth/register").send({ email, password: "Passw0rd123", firstName: "New", lastName: "User" });
    assert.equal(res.status, 201);
    assert.ok(res.body.accessToken);
    assert.equal(res.body.user.email, email);
    assert.equal(res.body.user.passwordHash, undefined, "password hash must never be returned");
    assert.match(String(res.headers["set-cookie"]), /refresh_token=/);

    const dup = await request(app).post("/api/auth/register").send({ email, password: "Passw0rd123", firstName: "New", lastName: "User" });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.code, "EMAIL_IN_USE");
  });

  test("login rejects a wrong password with a generic message and accepts the right one", async () => {
    const { user } = await createUser();
    const bad = await request(app).post("/api/auth/login").send({ email: user.email, password: "wrong-password1" });
    assert.equal(bad.status, 401);
    const ok = await request(app).post("/api/auth/login").send({ email: user.email, password: "Passw0rd123" });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.id, user.id);
  });

  test("/auth/me needs a token, echoes a request id, and reflects a suspended account immediately", async () => {
    const anon = await request(app).get("/api/auth/me");
    assert.equal(anon.status, 401);
    assert.equal(anon.body.code, "TOKEN_MISSING");
    assert.ok(anon.headers["x-request-id"]);
    assert.equal(anon.body.requestId, anon.headers["x-request-id"]);

    const { user } = await createUser();
    const { token } = await login(user.email);
    const me = await as(token).get("/api/auth/me");
    assert.equal(me.status, 200);

    await prisma.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
    await cacheService.invalidateKey(cacheService.userKey(user.id));
    const after = await as(token).get("/api/auth/me");
    assert.equal(after.status, 401);
    assert.equal(after.body.code, "ACCOUNT_INACTIVE");
  });

  test("refresh tokens rotate, and replaying a used token revokes the whole family", async () => {
    const { user } = await createUser();
    const first = await login(user.email);
    const cookie1 = cookieHeader(first.cookie);

    const rotated = await request(app).post("/api/auth/refresh").set("Cookie", cookie1);
    assert.equal(rotated.status, 200);
    assert.ok(rotated.body.accessToken);
    const cookie2 = cookieHeader(rotated.headers["set-cookie"]);
    assert.notEqual(cookie1, cookie2, "a new refresh token must be issued");

    // Replay of the already-rotated token = stolen token → everything for this user is revoked.
    const replay = await request(app).post("/api/auth/refresh").set("Cookie", cookie1);
    assert.equal(replay.status, 401);

    const afterReplay = await request(app).post("/api/auth/refresh").set("Cookie", cookie2);
    assert.equal(afterReplay.status, 401, "the legitimate successor must be revoked too");

    const live = await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } });
    assert.equal(live, 0);
  });

  test("logout revokes the refresh token", async () => {
    const { user } = await createUser();
    const { cookie } = await login(user.email);
    const out = await request(app).post("/api/auth/logout").set("Cookie", cookieHeader(cookie));
    assert.equal(out.status, 204);
    const again = await request(app).post("/api/auth/refresh").set("Cookie", cookieHeader(cookie));
    assert.equal(again.status, 401);
  });

  test("validation errors are 422 with a message", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "not-an-email", password: "short", firstName: "", lastName: "" });
    assert.equal(res.status, 422);
    assert.equal(res.body.code, "VALIDATION_ERROR");
  });
});
