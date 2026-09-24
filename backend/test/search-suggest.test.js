const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
// helpers loads test/bootstrap.js, which points DATABASE_URL at the test database — it MUST come
// before anything that loads src/config (the app), otherwise resetDb() would wipe the dev database.
const { prisma, resetDb, teardown, createUser, createStore, createCategory, createListing } = require("./helpers");
const request = require("supertest");
const app = require("../src/app");

describe("search suggestions", () => {
  let store, category;

  before(async () => {
    await resetDb();
    const { user } = await createUser();
    ({ store } = await createStore(user.id));
    store = await prisma.store.update({ where: { id: store.id }, data: { name: "Bose Audio Corner" } });
    category = await createCategory({ name: "Bose Headsets" });
    await createListing(store.id, category.id, { title: "Bose QuietComfort Ultra Headphones", price: 185000 });
    await createListing(store.id, category.id, { title: "bose SoundLink Flex speaker", price: 95000 });
    await createListing(store.id, category.id, { title: "Sony WH-1000XM5", price: 180000 });
  });
  after(teardown);

  test("needs at least two characters", async () => {
    const res = await request(app).get("/api/search/suggest?q=b");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { query: "b", products: [], categories: [], stores: [] });
  });

  test("returns matching products, categories and stores, case-insensitively, with a tiny payload", async () => {
    const res = await request(app).get("/api/search/suggest?q=BOSE");
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.query, "BOSE");
    assert.deepEqual(res.body.products.map((p) => p.title).sort(), ["Bose QuietComfort Ultra Headphones", "bose SoundLink Flex speaker"]);
    assert.ok(res.body.products.every((p) => "slug" in p && "price" in p && "image" in p && !("description" in p)));
    assert.deepEqual(res.body.categories.map((c) => c.name), ["Bose Headsets"]);
    assert.deepEqual(res.body.stores.map((s) => s.name), ["Bose Audio Corner"]);
    assert.match(res.headers["cache-control"], /max-age=15/);
  });

  test("never suggests a listing the public cannot open", async () => {
    const draft = await createListing(store.id, category.id, { title: "Bose draft that must stay hidden", price: 1000 });
    await prisma.advertisement.update({ where: { id: draft.id }, data: { status: "DRAFT" } });
    const res = await request(app).get("/api/search/suggest?q=bose%20draft");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.products, []);
  });

  test("trims, collapses whitespace and caps the query length", async () => {
    const long = "x".repeat(200);
    const res = await request(app).get(`/api/search/suggest?q=${encodeURIComponent("  bose   sound  " + long)}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.query.length <= 80);
    assert.ok(res.body.query.startsWith("bose sound"));
  });
});
