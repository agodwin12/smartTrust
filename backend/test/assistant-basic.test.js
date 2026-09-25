const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
// helpers first: it loads test/bootstrap.js (ANTHROPIC_API_KEY is empty there, so the built-in mode answers).
const { app, request, resetDb, teardown, createUser, createStore, createCategory, createListing, createPaidOrder, login, as } = require("./helpers");

const ask = (text, { token, locale = "en" } = {}) => {
  const req = token ? as(token) : request(app);
  return req.post("/api/assistant/chat").send({ messages: [{ role: "user", content: text }], locale });
};

describe("chat assistant without an Anthropic key (built-in mode)", () => {
  let buyer, sofa;

  before(async () => {
    await resetDb();
    const { user } = await createUser();
    buyer = { user, ...(await login(user.email)) };
    const { user: seller } = await createUser();
    const { store } = await createStore(seller.id);
    const category = await createCategory({ name: "Furniture" });
    sofa = await createListing(store.id, category.id, { title: "Grey Fabric Sofa", price: 320000 });
    await createListing(store.id, category.id, { title: "Leather Sofa XL", price: 650000 });
    await createListing(store.id, category.id, { title: "Oak Coffee Table", price: 45000, compareAtPrice: 60000 });
  });
  after(teardown);

  test("status reports the chat as available in basic mode", async () => {
    const res = await request(app).get("/api/assistant/status");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { enabled: true, mode: "basic" });
  });

  test("a product question returns matching listings as cards, with a budget filter", async () => {
    const res = await ask("I am looking for a sofa");
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.model, "basic");
    assert.deepEqual(res.body.products.map((p) => p.title).sort(), ["Grey Fabric Sofa", "Leather Sofa XL"]);

    const cheap = await ask("sofa under 400000");
    assert.deepEqual(cheap.body.products.map((p) => p.title), ["Grey Fabric Sofa"]);

    const fr = await ask("je cherche une table");
    assert.match(fr.body.reply, /annonce/, "answers in French when the user writes French");
    assert.deepEqual(fr.body.products.map((p) => p.title), ["Oak Coffee Table"]);
  });

  test("orders, escrow, selling and human hand-off get useful answers", async () => {
    const anon = await ask("where is my order?");
    assert.match(anon.body.reply, /\/login/);
    assert.match(anon.body.reply, /\/orders\/track/);

    await createPaidOrder(buyer.user.id, sofa);
    const mine = await ask("track my order", { token: buyer.token });
    assert.equal(mine.body.orders.length, 1);

    assert.match((await ask("how does escrow work?")).body.reply, /escrow/i);
    assert.match((await ask("I want to sell my phones")).body.reply, /\/sell/);
    const human = await ask("can I talk to a human?");
    assert.match(human.body.reply, /\/help\/contact/);
  });

  test("unknown products fall back to browsing and contact", async () => {
    const res = await ask("helicopter");
    assert.equal(res.body.products.length, 0);
    assert.match(res.body.reply, /\/categories/);
  });

  test("the public contact endpoint answers even without a WhatsApp number", async () => {
    const res = await request(app).get("/api/site/contact");
    assert.equal(res.status, 200);
    assert.ok("whatsapp" in res.body && "whatsappUrl" in res.body);
  });
});
