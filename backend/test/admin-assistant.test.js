const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
// helpers first: it loads test/bootstrap.js (GEMINI_API_KEY is empty, so no real Gemini call is made).
const { app, prisma, request, resetDb, teardown, createUser, createStore, createCategory, createListing, createPaidOrder, login, as } = require("./helpers");
const adminAssistant = require("../src/services/adminAssistant.service");
const gemini = require("../src/services/gemini.service");

const ask = (token, text, locale = "en") => as(token).post("/api/admin/assistant/chat").send({ messages: [{ role: "user", content: text }], locale });
const run = (name, args = {}) => adminAssistant.tools[name](adminAssistant.inputs[name].parse(args));

describe("Super Admin AI assistant", () => {
  let admin, accountant, cs, customer, trustStore, otherStore, blender, sofa, paidOrder;

  before(async () => {
    await resetDb();
    const [sa, acc, c, cu, s1, s2] = await Promise.all([
      createUser({ role: "SUPER_ADMIN" }),
      createUser({ role: "ACCOUNTANT" }),
      createUser({ role: "CUSTOMER_SERVICE" }),
      createUser({ firstName: "Awa", lastName: "Buyer" }),
      createUser(),
      createUser(),
    ]);
    admin = { ...sa, ...(await login(sa.user.email)) };
    accountant = { ...acc, ...(await login(acc.user.email)) };
    cs = { ...c, ...(await login(c.user.email)) };
    customer = { ...cu, ...(await login(cu.user.email)) };
    ({ store: trustStore } = await createStore(s1.user.id));
    await prisma.store.update({ where: { id: trustStore.id }, data: { name: "Smart Trust Test" } });
    ({ store: otherStore } = await createStore(s2.user.id));
    const category = await createCategory();
    blender = await createListing(trustStore.id, category.id, { title: "Compact Blender", price: 9900 });
    sofa = await createListing(otherStore.id, category.id, { title: "Corner Sofa", price: 250000 });
    paidOrder = await createPaidOrder(customer.user.id, blender, { quantity: 2 });
    await createPaidOrder(customer.user.id, sofa);
    // An older order outside "today", to check date filters.
    const old = await createPaidOrder(customer.user.id, sofa);
    await prisma.order.update({ where: { id: old.id }, data: { createdAt: new Date("2026-01-10T10:00:00Z"), status: "COMPLETED", sellerConfirmedAt: new Date(), buyerConfirmedAt: new Date() } });
  });
  after(teardown);

  test("only the Super Admin can reach the assistant", async () => {
    for (const who of [accountant, cs, customer]) {
      assert.equal((await ask(who.token, "what happened today?")).status, 403, `${who.user.role} is refused`);
      assert.equal((await as(who.token).get("/api/admin/assistant/status")).status, 403);
    }
    assert.equal((await request(app).post("/api/admin/assistant/chat").send({ messages: [{ role: "user", content: "hi" }] })).status, 401);
    const status = await as(admin.token).get("/api/admin/assistant/status");
    assert.equal(status.status, 200);
    assert.deepEqual(status.body, { configured: false, available: false, model: "gemini-2.5-flash" });
  });

  test("without Gemini the Super Admin still gets today's summary, and the question is audited", async () => {
    const res = await ask(admin.token, "What happened today?");
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.model, "fallback");
    assert.match(res.body.reply, /today's summary/);
    assert.match(res.body.reply, /Orders: 2 \(269,800 FCFA\)/, "two orders placed today: 2 × 9,900 + 250,000");
    const fr = await ask(admin.token, "Quoi de neuf ?", "fr");
    assert.match(fr.body.reply, /résumé d'aujourd'hui/);
    const audited = await prisma.auditLog.findFirst({ where: { action: "ADMIN_ASSISTANT_QUERY", actorId: admin.user.id } });
    assert.equal(audited.metadata.question, "What happened today?");
  });

  test("search_orders combines store, status, delivery and date filters", async () => {
    const all = await run("search_orders", {});
    assert.equal(all.total, 3);
    const trust = await run("search_orders", { store: "smart trust" });
    assert.equal(trust.total, 1);
    assert.equal(trust.orders[0].item, "Compact Blender");
    assert.equal(trust.orders[0].total, "19,800 FCFA");
    assert.equal(trust.orders[0].shortId, paidOrder.id.slice(-8).toUpperCase());
    assert.equal(trust.orders[0].link, `/admin/orders/${paidOrder.id}`);

    const waiting = await run("search_orders", { awaitingDelivery: true });
    assert.equal(waiting.total, 2, "paid orders the sellers have not delivered");
    const completed = await run("search_orders", { status: "COMPLETED" });
    assert.equal(completed.total, 1);
    const january = await run("search_orders", { from: "2026-01-01", to: "2026-01-31" });
    assert.equal(january.total, 1);
    assert.equal(january.period.from, "2026-01-01");
    const byBuyer = await run("search_orders", { buyer: "awa", minAmount: 100000 });
    assert.equal(byBuyer.total, 2);
  });

  test("get_order, platform_summary and top_stores report consistent figures", async () => {
    const one = await run("get_order", { id: paidOrder.id.slice(-8) });
    assert.equal(one.orders.length, 1);
    assert.match(one.orders[0].timeline.payment, /COMPLETED 19,800 FCFA/);
    assert.match(one.orders[0].timeline.escrow, /HELD/);
    assert.ok((await run("get_order", { id: "ZZZZZZZZ" })).error);

    const today = await run("platform_summary", {});
    assert.equal(today.orders.total, 2);
    assert.equal(today.orders.byStatus.PAID.count, 2);
    assert.equal(today.now.ordersAwaitingDelivery, 2);
    assert.equal(today.now.escrowHeld, "519,800 FCFA", "all three orders were created with a held escrow");

    const top = await run("top_stores", {});
    assert.equal(top.stores[0].slug, otherStore.slug, "the sofa store sells the most in the last 30 days");
  });

  test("Douala dates and relative periods", () => {
    const { where } = adminAssistant.range({ from: "2026-09-26", to: "2026-09-26" });
    assert.equal(where.gte.toISOString(), "2026-09-25T23:00:00.000Z", "midnight in Douala is 23:00 UTC the day before");
    assert.equal(where.lt.toISOString(), "2026-09-26T23:00:00.000Z", "the end day is inclusive");
    const c = adminAssistant.calendar(new Date("2026-09-26T10:00:00Z"));
    assert.deepEqual(c.thisWeek, ["2026-09-21", "2026-09-26"], "the week starts on Monday");
    assert.deepEqual(c.lastWeek, ["2026-09-14", "2026-09-20"]);
    assert.deepEqual(c.lastMonth, ["2026-08-01", "2026-08-31"]);
  });

  test("tool declarations are valid for Gemini (no unsupported schema keywords)", () => {
    const [{ functionDeclarations }] = gemini.declarations(adminAssistant.TOOLS);
    assert.equal(functionDeclarations.length, 9);
    assert.ok(!/"(minimum|maximum|default|additionalProperties)"/.test(JSON.stringify(functionDeclarations)));
    assert.deepEqual(functionDeclarations.find((f) => f.name === "get_order").parameters.required, ["id"]);
  });
});
