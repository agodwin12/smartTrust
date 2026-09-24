const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { prisma, resetDb, teardown, eventually, createUser, createStore, createCategory, createListing, login, as } = require("./helpers");

describe("cash on delivery", () => {
  let buyer, seller, store, listing, category;
  const cod = (advertisementId, extra = {}) => ({ advertisementId, quantity: 1, paymentMethod: "CASH_ON_DELIVERY", deliveryAddress: "Rue 1234, Bonapriso, Douala", deliveryPhone: "237690000000", ...extra });

  before(async () => {
    await resetDb();
    const [b, s] = await Promise.all([createUser(), createUser()]);
    buyer = { ...b, ...(await login(b.user.email)) };
    seller = { ...s, ...(await login(s.user.email)) };
    ({ store } = await createStore(seller.user.id));
    category = await createCategory();
    listing = await createListing(store.id, category.id, { price: 40000 });
  });
  after(teardown);

  const wallet = async () => Number((await prisma.wallet.findUnique({ where: { storeId: store.id } })).balance);

  test("a cash order is confirmed immediately, has no payment or escrow, and notifies both sides", async () => {
    const res = await as(buyer.token).post("/api/orders").send(cod(listing.id));
    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.order.status, "CONFIRMED");
    assert.equal(res.body.order.paymentMethod, "CASH_ON_DELIVERY");
    assert.equal(res.body.order.deliveryAddress, "Rue 1234, Bonapriso, Douala");
    const full = await prisma.order.findUnique({ where: { id: res.body.order.id }, include: { payment: true, escrow: true } });
    assert.equal(full.payment, null);
    assert.equal(full.escrow, null);
    await eventually(async () => {
      assert.ok(await prisma.notification.findFirst({ where: { userId: buyer.user.id, type: "ORDER_CONFIRMED", data: { path: ["orderId"], equals: full.id } } }));
      assert.ok(await prisma.notification.findFirst({ where: { userId: seller.user.id, type: "NEW_ORDER", data: { path: ["orderId"], equals: full.id } } }));
    });
  });

  test("delivery details are mandatory and a Mobile Money payment is refused on a cash order", async () => {
    const missing = await as(buyer.token).post("/api/orders").send({ advertisementId: listing.id, paymentMethod: "CASH_ON_DELIVERY" });
    assert.equal(missing.status, 422);
    const { body } = await as(buyer.token).post("/api/orders").send(cod(listing.id));
    const pay = await as(buyer.token).post(`/api/orders/${body.order.id}/pay`).send({ provider: "MTN_MOMO_CMR", phoneNumber: "237690000000" });
    assert.equal(pay.status, 409);
    assert.equal(pay.body.code, "ORDER_NOT_PAYABLE");
    const dispute = await as(buyer.token).post(`/api/orders/${body.order.id}/dispute`).send({ reason: "Cash orders are not covered by escrow." });
    assert.equal(dispute.status, 409);
    assert.equal(dispute.body.code, "ORDER_NOT_DISPUTABLE");
  });

  test("a store that switched cash off refuses cash orders but still takes Mobile Money", async () => {
    await prisma.store.update({ where: { id: store.id }, data: { acceptsCashOnDelivery: false } });
    const refused = await as(buyer.token).post("/api/orders").send(cod(listing.id));
    assert.equal(refused.status, 422);
    assert.equal(refused.body.code, "COD_NOT_ACCEPTED");
    const momo = await as(buyer.token).post("/api/orders").send({ advertisementId: listing.id });
    assert.equal(momo.status, 201);
    assert.equal(momo.body.order.status, "PENDING_PAYMENT");
    await prisma.store.update({ where: { id: store.id }, data: { acceptsCashOnDelivery: true } });
  });

  test("seller settings can toggle the option through the store endpoint", async () => {
    const off = await as(seller.token).patch("/api/stores/me").send({ acceptsCashOnDelivery: false });
    assert.equal(off.status, 200, off.text);
    assert.equal(off.body.store.acceptsCashOnDelivery, false);
    const on = await as(seller.token).patch("/api/stores/me").send({ acceptsCashOnDelivery: "true" });
    assert.equal(on.body.store.acceptsCashOnDelivery, true);
    const pub = await prisma.advertisement.findUnique({ where: { id: listing.id }, include: { store: { select: { acceptsCashOnDelivery: true } } } });
    assert.equal(pub.store.acceptsCashOnDelivery, true);
  });

  test("handover confirmations complete the order without touching the seller wallet", async () => {
    const { body } = await as(buyer.token).post("/api/orders").send(cod(listing.id));
    const before = await wallet();
    const delivered = await as(seller.token).post(`/api/orders/${body.order.id}/confirm-delivery`);
    assert.equal(delivered.status, 200, delivered.text);
    assert.equal(delivered.body.order.status, "CONFIRMED");
    const received = await as(buyer.token).post(`/api/orders/${body.order.id}/confirm-receipt`);
    assert.equal(received.status, 200);
    assert.equal(received.body.order.status, "COMPLETED");
    assert.equal(await wallet(), before, "cash never goes through the platform wallet");
    const review = await as(buyer.token).post(`/api/orders/${body.order.id}/review`).send({ rating: 5, comment: "Paid cash, all good." });
    assert.equal(review.status, 201);
  });

  test("either side can cancel before the handover, nobody after the seller confirmed delivery", async () => {
    const a = (await as(buyer.token).post("/api/orders").send(cod(listing.id))).body.order;
    const byBuyer = await as(buyer.token).post(`/api/orders/${a.id}/cancel`).send({ reason: "Changed my mind." });
    assert.equal(byBuyer.status, 200, byBuyer.text);
    assert.equal(byBuyer.body.order.status, "CANCELLED");
    assert.equal(byBuyer.body.order.cancelledBy, "BUYER");
    await eventually(async () => assert.ok(await prisma.notification.findFirst({ where: { userId: seller.user.id, type: "ORDER_CANCELLED" } })));

    const b = (await as(buyer.token).post("/api/orders").send(cod(listing.id))).body.order;
    const bySeller = await as(seller.token).post(`/api/orders/${b.id}/cancel`).send({ reason: "Out of stock." });
    assert.equal(bySeller.status, 200);
    assert.equal(bySeller.body.order.cancelledBy, "SELLER");

    const c = (await as(buyer.token).post("/api/orders").send(cod(listing.id))).body.order;
    await as(seller.token).post(`/api/orders/${c.id}/confirm-delivery`);
    const tooLate = await as(buyer.token).post(`/api/orders/${c.id}/cancel`).send({});
    assert.equal(tooLate.status, 409);
    assert.equal(tooLate.body.code, "ORDER_NOT_CANCELLABLE");

    const { user: stranger } = await createUser();
    const s = await login(stranger.email);
    const d = (await as(buyer.token).post("/api/orders").send(cod(listing.id))).body.order;
    assert.equal((await as(s.token).post(`/api/orders/${d.id}/cancel`).send({})).status, 403);
  });

  test("an unpaid Mobile Money order can be cancelled by its buyer, a paid one cannot", async () => {
    const pending = (await as(buyer.token).post("/api/orders").send({ advertisementId: listing.id })).body.order;
    const ok = await as(buyer.token).post(`/api/orders/${pending.id}/cancel`).send({});
    assert.equal(ok.status, 200);
    assert.equal(ok.body.order.status, "CANCELLED");

    const paid = await prisma.order.create({ data: { buyerId: buyer.user.id, advertisementId: listing.id, quantity: 1, totalAmount: 40000, status: "PAID", escrow: { create: { amount: 40000, status: "HELD" } } } });
    const refused = await as(buyer.token).post(`/api/orders/${paid.id}/cancel`).send({});
    assert.equal(refused.status, 409);
  });

  test("the seller dashboard counts cash orders awaiting delivery", async () => {
    await as(buyer.token).post("/api/orders").send(cod(listing.id));
    const dash = await as(seller.token).get("/api/stores/me");
    assert.equal(dash.status, 200);
    assert.ok(dash.body.store.stats.ordersToDeliver >= 1);
  });
});
