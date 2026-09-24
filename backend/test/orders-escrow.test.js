const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, resetDb, teardown, eventually, createUser, createStore, createCategory, createListing, createPaidOrder, login, as, signWebhook, uid, DAY_MS } = require("./helpers");
const paymentService = require("../src/services/payment.service");
const escrowService = require("../src/services/escrow.service");

describe("orders, escrow, disputes and refunds", () => {
  let buyer, seller, sa, cs, store, listing, category;

  before(async () => {
    await resetDb();
    const [b, s, a, c] = await Promise.all([createUser(), createUser(), createUser({ role: "SUPER_ADMIN" }), createUser({ role: "CUSTOMER_SERVICE" })]);
    buyer = { ...b, ...(await login(b.user.email)) };
    seller = { ...s, ...(await login(s.user.email)) };
    sa = { ...a, ...(await login(a.user.email)) };
    cs = { ...c, ...(await login(c.user.email)) };
    ({ store } = await createStore(seller.user.id));
    category = await createCategory();
    listing = await createListing(store.id, category.id, { price: 25000 });
  });
  after(teardown);

  const wallet = async () => Number((await prisma.wallet.findUnique({ where: { storeId: store.id } })).balance);

  test("a buyer can order a visible listing; sellers cannot buy their own; drafts are not orderable", async () => {
    const res = await as(buyer.token).post("/api/orders").send({ advertisementId: listing.id, quantity: 2 });
    assert.equal(res.status, 201);
    assert.equal(res.body.order.status, "PENDING_PAYMENT");
    assert.equal(Number(res.body.order.totalAmount), 50000);

    const own = await as(seller.token).post("/api/orders").send({ advertisementId: listing.id });
    assert.equal(own.status, 422);
    assert.equal(own.body.code, "CANNOT_BUY_OWN_LISTING");

    const draft = await createListing(store.id, category.id, { status: "DRAFT" });
    const hidden = await as(buyer.token).post("/api/orders").send({ advertisementId: draft.id });
    assert.equal(hidden.status, 404);
  });

  test("listings of a suspended store or a lapsed subscription cannot be ordered", async () => {
    const { user: other } = await createUser();
    const { store: suspended } = await createStore(other.id, { status: "SUSPENDED" });
    const ad1 = await createListing(suspended.id, category.id);
    assert.equal((await as(buyer.token).post("/api/orders").send({ advertisementId: ad1.id })).status, 404);

    const { user: lapsedOwner } = await createUser();
    const { store: lapsed } = await createStore(lapsedOwner.id, { expiresAt: new Date(Date.now() - DAY_MS) });
    const ad2 = await createListing(lapsed.id, category.id);
    assert.equal((await as(buyer.token).post("/api/orders").send({ advertisementId: ad2.id })).status, 404);
  });

  test("a completed payment moves the order into escrow exactly once, even when the webhook is delivered twice", async () => {
    const { body } = await as(buyer.token).post("/api/orders").send({ advertisementId: listing.id });
    const externalId = `order-${uid()}`;
    await prisma.payment.create({ data: { orderId: body.order.id, amount: 25000, externalId, provider: "KPAY", operator: "MTN_MOMO_CMR", phoneNumber: "237690000000", status: "PENDING" } });

    const first = await paymentService.applyStatusUpdate({ externalId, providerPaymentId: "pay_1", providerReference: "KPAY-1", status: "COMPLETED" });
    const second = await paymentService.applyStatusUpdate({ externalId, providerPaymentId: "pay_1", providerReference: "KPAY-1", status: "COMPLETED" });
    assert.equal(first.status, "COMPLETED");
    assert.equal(second.status, "COMPLETED");

    const order = await prisma.order.findUnique({ where: { id: body.order.id }, include: { escrow: true } });
    assert.equal(order.status, "PAID");
    assert.equal(order.escrow.status, "HELD");
    assert.equal(await prisma.escrowTransaction.count({ where: { orderId: order.id } }), 1);
  });

  test("dual confirmation releases escrow to the seller wallet once; repeats are rejected", async () => {
    const order = await createPaidOrder(buyer.user.id, listing);
    const before = await wallet();

    const wrongSide = await as(buyer.token).post(`/api/orders/${order.id}/confirm-delivery`);
    assert.equal(wrongSide.status, 403);

    const delivered = await as(seller.token).post(`/api/orders/${order.id}/confirm-delivery`);
    assert.equal(delivered.status, 200);
    assert.ok(delivered.body.order.sellerConfirmedAt);
    assert.equal(delivered.body.order.status, "PAID", "one confirmation is not enough");

    const received = await as(buyer.token).post(`/api/orders/${order.id}/confirm-receipt`);
    assert.equal(received.status, 200);
    assert.equal(received.body.order.status, "COMPLETED");
    assert.equal(await wallet(), before + 25000);

    const again = await as(buyer.token).post(`/api/orders/${order.id}/confirm-receipt`);
    assert.equal(again.status, 409);
    assert.equal(await wallet(), before + 25000, "no double credit");
  });

  test("two concurrent releases of the same escrow credit the wallet exactly once", async () => {
    const order = await createPaidOrder(buyer.user.id, listing);
    await prisma.order.update({ where: { id: order.id }, data: { sellerConfirmedAt: new Date(), buyerConfirmedAt: new Date() } });
    const before = await wallet();
    await Promise.all([escrowService.release(order.id), escrowService.release(order.id)]);
    assert.equal(await wallet(), before + 25000);
    const escrow = await prisma.escrowTransaction.findUnique({ where: { orderId: order.id } });
    assert.equal(escrow.status, "RELEASED");
  });

  test("a dispute freezes the order; refunding the buyer needs finance rights, settles escrow and creates a refund", async () => {
    const order = await createPaidOrder(buyer.user.id, listing);
    const before = await wallet();

    const tooShort = await as(buyer.token).post(`/api/orders/${order.id}/dispute`).send({ reason: "bad" });
    assert.equal(tooShort.status, 422);
    const disputed = await as(buyer.token).post(`/api/orders/${order.id}/dispute`).send({ reason: "The item arrived broken and the seller does not answer." });
    assert.equal(disputed.status, 201);
    const disputeId = disputed.body.dispute.id;
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).status, "DISPUTED");

    const csAttempt = await as(cs.token).post(`/api/disputes/${disputeId}/refund-buyer`).send({ resolution: "refund" });
    assert.equal(csAttempt.status, 403);

    const refunded = await as(sa.token).post(`/api/disputes/${disputeId}/refund-buyer`).send({ resolution: "Broken on arrival, photos verified." });
    assert.equal(refunded.status, 200);
    assert.equal(refunded.body.dispute.status, "RESOLVED");
    assert.ok(refunded.body.dispute.refund, "a refund row is created for the buyer");
    assert.equal(Number(refunded.body.dispute.refund.amount), 25000);
    assert.equal(refunded.body.dispute.refund.phoneNumber, "237690000000");
    // The payment provider is unreachable in tests, so the payout is stored as FAILED with the reason for staff to retry.
    assert.equal(refunded.body.dispute.refund.status, "FAILED");
    assert.ok(refunded.body.dispute.refund.failureReason);

    const settled = await prisma.order.findUnique({ where: { id: order.id }, include: { escrow: true } });
    assert.equal(settled.status, "REFUNDED");
    assert.equal(settled.escrow.status, "REFUNDED");
    assert.equal(await wallet(), before, "the seller wallet is untouched by a refund");

    const twice = await as(sa.token).post(`/api/disputes/${disputeId}/refund-buyer`).send({ resolution: "again" });
    assert.ok([200, 409].includes(twice.status));
    assert.equal(await prisma.refund.count({ where: { orderId: order.id } }), 1, "never more than one refund per order");
  });

  test("the payout webhook settles an in-flight refund and notifies the buyer; a bad signature is rejected", async () => {
    const order = await createPaidOrder(buyer.user.id, listing);
    await prisma.$transaction([
      prisma.escrowTransaction.update({ where: { orderId: order.id }, data: { status: "REFUNDED" } }),
      prisma.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } }),
    ]);
    const refund = await prisma.refund.create({
      data: { orderId: order.id, amount: 25000, provider: "KPAY", operator: "MTN_MOMO_CMR", phoneNumber: "237690000000", externalId: `rf-${uid()}`, providerPayoutId: "wdr_1", status: "PROCESSING", attempts: 1 },
    });
    const body = JSON.stringify({ event: "payout.completed", payoutId: "wdr_1", reference: "KPAY-WD-1", externalId: refund.externalId, status: "COMPLETED" });

    const forged = await request(app).post("/api/payments/webhooks/kpay").set("Content-Type", "application/json").set("X-KPAY-Signature", "deadbeef").send(body);
    assert.equal(forged.status, 401);

    const genuine = await request(app).post("/api/payments/webhooks/kpay").set("Content-Type", "application/json").set("X-KPAY-Signature", signWebhook(body)).send(body);
    assert.equal(genuine.status, 200);

    const updated = await prisma.refund.findUnique({ where: { id: refund.id } });
    assert.equal(updated.status, "COMPLETED");
    assert.ok(updated.completedAt);
    await eventually(async () => {
      const note = await prisma.notification.findFirst({ where: { userId: buyer.user.id, type: "REFUND_SENT" } });
      assert.ok(note, "buyer is told the money was sent");
    });

    const replay = await request(app).post("/api/payments/webhooks/kpay").set("Content-Type", "application/json").set("X-KPAY-Signature", signWebhook(body)).send(body);
    assert.equal(replay.status, 200);
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(await prisma.notification.count({ where: { userId: buyer.user.id, type: "REFUND_SENT" } }), 1, "a replayed webhook does not notify twice");
  });

  test("order detail is visible to its buyer, its seller and staff, and to nobody else", async () => {
    const order = await createPaidOrder(buyer.user.id, listing);
    const { user: stranger } = await createUser();
    const strangerSession = await login(stranger.email);
    assert.equal((await as(buyer.token).get(`/api/orders/${order.id}`)).status, 200);
    assert.equal((await as(seller.token).get(`/api/orders/${order.id}`)).status, 200);
    assert.equal((await as(cs.token).get(`/api/orders/${order.id}`)).status, 200);
    assert.equal((await as(strangerSession.token).get(`/api/orders/${order.id}`)).status, 403);
  });
});
