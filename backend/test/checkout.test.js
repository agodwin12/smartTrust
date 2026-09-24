const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
// helpers first: it loads test/bootstrap.js, which points the app at the *_test database.
const { app, prisma, request, resetDb, teardown, eventually, createUser, createStore, createCategory, createListing, login, as, signWebhook } = require("./helpers");

describe("cart checkout (groups) and guest orders", () => {
  let buyer, other, seller1, seller2, store1, store2, ad1, ad2, ad3;

  before(async () => {
    await resetDb();
    const [b, o, s1, s2] = await Promise.all([createUser(), createUser(), createUser(), createUser()]);
    buyer = { ...b, ...(await login(b.user.email)) };
    other = { ...o, ...(await login(o.user.email)) };
    seller1 = { ...s1, ...(await login(s1.user.email)) };
    seller2 = { ...s2, ...(await login(s2.user.email)) };
    ({ store: store1 } = await createStore(seller1.user.id));
    ({ store: store2 } = await createStore(seller2.user.id));
    const category = await createCategory();
    ad1 = await createListing(store1.id, category.id, { title: "Blender", price: 15000 });
    ad2 = await createListing(store2.id, category.id, { title: "Sofa", price: 250000 });
    ad3 = await createListing(store2.id, category.id, { title: "Lamp", price: 8000 });
  });
  after(teardown);

  const codBody = (items) => ({ items, paymentMethod: "CASH_ON_DELIVERY", deliveryAddress: "Rue 12, Bonapriso, Douala", deliveryPhone: "237690000001" });

  test("a signed-in buyer checks out several listings from two stores in one cash order", async () => {
    const res = await as(buyer.token).post("/api/checkout").send(codBody([{ advertisementId: ad1.id, quantity: 2 }, { advertisementId: ad2.id, quantity: 1 }, { advertisementId: ad1.id, quantity: 1 }]));
    assert.equal(res.status, 201, res.text);
    const { group } = res.body;
    assert.match(group.reference, /^SM-[A-Z2-9]{6}$/);
    assert.equal(group.isGuest, false);
    assert.equal(group.itemCount, 4, "duplicate cart lines are merged (3 blenders + 1 sofa)");
    assert.equal(Number(group.totalAmount), 3 * 15000 + 250000);
    assert.equal(group.orders.length, 2);
    assert.ok(group.orders.every((o) => o.status === "CONFIRMED" && o.paymentMethod === "CASH_ON_DELIVERY" && o.groupId === group.id));
    assert.equal(group.orders.find((o) => o.advertisementId === ad1.id).quantity, 3);

    const mine = await as(buyer.token).get(`/api/checkout/${group.id}`);
    assert.equal(mine.status, 200);
    const stranger = await as(other.token).get(`/api/checkout/${group.id}`);
    assert.equal(stranger.status, 403);
    const anonymous = await request(app).get(`/api/checkout/${group.id}`);
    assert.equal(anonymous.status, 403);

    const list = await as(buyer.token).get("/api/orders/me");
    assert.equal(list.body.items.filter((o) => o.group?.reference === group.reference).length, 2, "the orders list carries the group reference");
    await eventually(async () => assert.ok(await prisma.notification.findFirst({ where: { userId: seller2.user.id, type: "NEW_ORDER" } })));
  });

  test("cash on delivery is refused when one of the stores does not offer it", async () => {
    await prisma.store.update({ where: { id: store2.id }, data: { acceptsCashOnDelivery: false } });
    const res = await as(buyer.token).post("/api/checkout").send(codBody([{ advertisementId: ad1.id, quantity: 1 }, { advertisementId: ad3.id, quantity: 1 }]));
    assert.equal(res.status, 422);
    assert.equal(res.body.code, "COD_NOT_ACCEPTED");
    assert.match(res.body.error, new RegExp(store2.name));
    await prisma.store.update({ where: { id: store2.id }, data: { acceptsCashOnDelivery: true } });

    const own = await as(seller1.token).post("/api/checkout").send(codBody([{ advertisementId: ad1.id, quantity: 1 }]));
    assert.equal(own.status, 422);
    assert.equal(own.body.code, "CANNOT_BUY_OWN_LISTING");
  });

  test("one Mobile Money payment covers every line and moves each one to escrow", async () => {
    const res = await as(buyer.token).post("/api/checkout").send({ items: [{ advertisementId: ad1.id, quantity: 1 }, { advertisementId: ad3.id, quantity: 2 }], paymentMethod: "MOBILE_MONEY" });
    assert.equal(res.status, 201, res.text);
    const { group } = res.body;
    assert.ok(group.orders.every((o) => o.status === "PENDING_PAYMENT"));

    // K-Pay is unreachable in tests (closed port): the attempt is recorded as FAILED and reported.
    const attempt = await as(buyer.token).post(`/api/checkout/${group.id}/pay`).send({ provider: "MTN_MOMO_CMR", phoneNumber: "237690000001" });
    assert.ok(attempt.status >= 500 || attempt.status === 502, `provider outage surfaces (${attempt.status})`);
    const failed = await prisma.payment.findUnique({ where: { groupId: group.id } });
    assert.equal(failed.status, "FAILED");
    assert.equal(Number(failed.amount), 15000 + 2 * 8000);

    // Simulate a successful attempt: a pending payment for the group, then the provider webhook.
    await prisma.payment.delete({ where: { id: failed.id } });
    const externalId = `group-${group.id}-test`;
    await prisma.payment.create({ data: { groupId: group.id, amount: 31000, externalId, provider: "KPAY", operator: "MTN_MOMO_CMR", phoneNumber: "237690000001", status: "PENDING" } });
    const body = JSON.stringify({ event: "payment.completed", paymentId: "pay_group_1", reference: "KPAY-G-1", externalId, status: "COMPLETED" });
    const hook = await request(app).post("/api/payments/webhooks/kpay").set("Content-Type", "application/json").set("X-KPAY-Signature", signWebhook(body)).send(body);
    assert.equal(hook.status, 200);

    const after = await as(buyer.token).get(`/api/checkout/${group.id}`);
    assert.equal(after.body.group.payment.status, "COMPLETED");
    assert.ok(after.body.group.orders.every((o) => o.status === "PAID" && o.escrow?.status === "HELD"));
    assert.deepEqual(after.body.group.orders.map((o) => Number(o.escrow.amount)).sort((a, b) => a - b), [15000, 16000]);
    await eventually(async () => assert.equal(await prisma.notification.count({ where: { userId: buyer.user.id, type: "PAYMENT_CONFIRMED" } }), 2));
  });

  test("a guest orders with name and phone, follows the order by link or by reference + phone, and confirms receipt", async () => {
    const noDetails = await request(app).post("/api/checkout").send(codBody([{ advertisementId: ad1.id, quantity: 1 }]));
    assert.equal(noDetails.status, 401);

    const res = await request(app).post("/api/checkout").send({ ...codBody([{ advertisementId: ad1.id, quantity: 1 }]), guest: { name: "Marie Ngo", phone: "+237 6 55 00 00 02", email: "marie.guest@example.com" } });
    assert.equal(res.status, 201, res.text);
    const { group } = res.body;
    assert.equal(group.isGuest, true);
    assert.ok(group.accessToken, "the tracking token is returned to the guest");
    const guestUser = await prisma.user.findUnique({ where: { email: "marie.guest@example.com" } });
    assert.equal(guestUser.status, "GUEST");
    assert.equal(guestUser.firstName, "Marie");
    assert.equal(guestUser.passwordHash, null);

    const byLink = await request(app).get(`/api/checkout/${group.id}?token=${group.accessToken}`);
    assert.equal(byLink.status, 200);
    const badToken = await request(app).get(`/api/checkout/${group.id}?token=nope`);
    assert.equal(badToken.status, 403);

    const lookup = await request(app).post("/api/checkout/lookup").send({ reference: group.reference.toLowerCase(), phone: "655000002" });
    assert.equal(lookup.status, 200, "reference + the phone used at checkout");
    assert.equal(lookup.body.group.accessToken, group.accessToken);
    const wrongPhone = await request(app).post("/api/checkout/lookup").send({ reference: group.reference, phone: "699999999" });
    assert.equal(wrongPhone.status, 404);

    const orderId = group.orders[0].id;
    await as(seller1.token).post(`/api/orders/${orderId}/confirm-delivery`);
    const received = await request(app).post(`/api/checkout/${group.id}/orders/${orderId}/confirm-receipt`).send({ token: group.accessToken });
    assert.equal(received.status, 200, received.text);
    assert.equal(received.body.order.status, "COMPLETED");

    // Same guest again: the row is reused, not duplicated.
    const again = await request(app).post("/api/checkout").send({ ...codBody([{ advertisementId: ad3.id, quantity: 1 }]), guest: { name: "Marie Ngo", phone: "655000002" } });
    assert.equal(again.status, 201);
    assert.equal(again.body.group.buyerId, guestUser.id);

    // An email that belongs to a real account cannot be used as a guest.
    const taken = await request(app).post("/api/checkout").send({ ...codBody([{ advertisementId: ad3.id, quantity: 1 }]), guest: { name: "Xavier Fotso", phone: "677000000", email: buyer.user.email } });
    assert.equal(taken.status, 409);
    assert.equal(taken.body.code, "EMAIL_HAS_ACCOUNT");
  });

  test("registering with the guest's email upgrades the guest row and keeps the orders", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "marie.guest@example.com", password: "Passw0rd123", firstName: "Marie", lastName: "Ngo" });
    assert.equal(res.status, 201, res.text);
    const user = await prisma.user.findUnique({ where: { email: "marie.guest@example.com" } });
    assert.equal(user.status, "ACTIVE");
    assert.ok(user.passwordHash);
    const orders = await prisma.order.count({ where: { buyerId: user.id } });
    assert.equal(orders, 2, "both guest orders now belong to the account");
    assert.equal(await prisma.user.count({ where: { email: "marie.guest@example.com" } }), 1);
  });
});
