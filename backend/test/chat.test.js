const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
// helpers first: it loads test/bootstrap.js, which points the app at the *_test database.
const { app, prisma, request, resetDb, teardown, eventually, createUser, createStore, createCategory, createListing, login, as } = require("./helpers");
const { io: connect } = require("socket.io-client");
const storage = require("../src/services/storage.service");
const realtime = require("../src/realtime");

// Chat photos never reach R2 in tests; the real file-type check (magic bytes) still runs.
storage.uploadImage = async (file, folder) => {
  if (!storage.detectImageType(file.buffer)) {
    const err = new Error("Only JPEG, PNG or WebP images are allowed.");
    err.status = 422;
    err.code = "UNSUPPORTED_FILE_TYPE";
    throw err;
  }
  return `https://cdn.test/${folder}/${file.originalname}`;
};
storage.deleteImageByUrl = async () => {};

// A real 1×1 PNG.
const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c63f8cfc0f01f0005000201" + "a2b5e1b50000000049454e44ae426082", "hex");

function waitFor(socket, event, { timeoutMs = 3000, where = () => true } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`no "${event}" within ${timeoutMs} ms`));
    }, timeoutMs);
    function handler(payload) {
      if (!where(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}

describe("buyer ↔ seller chat", () => {
  let server, url, buyer, seller, stranger, cs, accountant, store, ad, otherStoreAd, conversationId;
  const sockets = [];
  const open = (token) => {
    const socket = connect(url, { auth: { token }, transports: ["websocket"], reconnection: false, forceNew: true });
    sockets.push(socket);
    return socket;
  };
  const connected = (socket) =>
    new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });

  before(async () => {
    await resetDb();
    server = http.createServer(app);
    realtime.init(server);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${server.address().port}`;

    const [b, s, x, c, a, o] = await Promise.all([createUser(), createUser(), createUser(), createUser({ role: "CUSTOMER_SERVICE" }), createUser({ role: "ACCOUNTANT" }), createUser()]);
    [buyer, seller, stranger, cs, accountant] = await Promise.all([b, s, x, c, a].map(async (u) => ({ ...u, ...(await login(u.user.email)) })));
    ({ store } = await createStore(seller.user.id));
    const category = await createCategory();
    ad = await createListing(store.id, category.id, { title: "Blender 380 ml" });
    const { store: otherStore } = await createStore(o.user.id);
    otherStoreAd = await createListing(otherStore.id, category.id);
  });
  after(async () => {
    sockets.forEach((socket) => socket.close());
    await realtime.close();
    await teardown();
  });

  test("a buyer opens one conversation per store from a product; a seller can't open one with their own store", async () => {
    const res = await as(buyer.token).post("/api/conversations").send({ advertisementId: ad.id });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.conversation.side, "buyer");
    assert.equal(res.body.conversation.store.id, store.id);
    assert.equal(res.body.conversation.advertisement.title, "Blender 380 ml");
    conversationId = res.body.conversation.id;

    const again = await as(buyer.token).post("/api/conversations").send({ storeId: store.id });
    assert.equal(again.body.conversation.id, conversationId, "the same thread is reused");

    const own = await as(seller.token).post("/api/conversations").send({ advertisementId: ad.id });
    assert.equal(own.status, 422);
    assert.equal(own.body.code, "OWN_STORE");
    assert.equal((await request(app).post("/api/conversations").send({ storeId: store.id })).status, 401, "guests sign in first");
    assert.equal((await as(buyer.token).post("/api/conversations").send({ advertisementId: "missing" })).status, 404);
    assert.equal((await as(buyer.token).post("/api/conversations").send({})).status, 422);
  });

  test("messages are delivered in real time to the other side, with unread counts", async () => {
    const sellerSocket = open(seller.token);
    await connected(sellerSocket);
    const arrival = waitFor(sellerSocket, "message:new");

    const sent = await as(buyer.token).post(`/api/conversations/${conversationId}/messages`).send({ body: "Hello, is the blender still available?", advertisementId: ad.id });
    assert.equal(sent.status, 201, sent.text);
    const pushed = await arrival;
    assert.equal(pushed.conversationId, conversationId);
    assert.equal(pushed.message.body, "Hello, is the blender still available?");
    assert.equal(pushed.message.advertisement.id, ad.id, "the product card travels with the message");

    assert.equal((await as(seller.token).get("/api/conversations/unread")).body.total, 1);
    const inbox = await as(seller.token).get("/api/conversations?role=selling");
    assert.equal(inbox.body.items.length, 1);
    assert.equal(inbox.body.items[0].side, "seller");
    assert.equal(inbox.body.items[0].unread, 1);
    assert.equal(inbox.body.items[0].buyer.id, buyer.user.id);

    const reply = await as(seller.token).post(`/api/conversations/${conversationId}/messages`).send({ body: "Yes, available!" });
    assert.equal(reply.status, 201);
    assert.equal((await as(seller.token).get("/api/conversations/unread")).body.total, 0, "replying reads the thread");
    assert.equal((await as(buyer.token).get("/api/conversations/unread")).body.total, 1);

    const page = await as(buyer.token).get(`/api/conversations/${conversationId}/messages`);
    assert.deepEqual(page.body.items.map((m) => m.body), ["Hello, is the blender still available?", "Yes, available!"]);
    assert.equal(page.body.hasMore, false);
  });

  test("photos can be shared; other files and products from another store are refused", async () => {
    const photo = await as(buyer.token).post(`/api/conversations/${conversationId}/messages`).field("clientId", "photo-0001").attach("image", PNG, { filename: "photo.png", contentType: "image/png" });
    assert.equal(photo.status, 201, photo.text);
    assert.match(photo.body.message.imageUrl, /^https:\/\/cdn\.test\/chat\//);
    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    assert.equal(conversation.lastMessagePreview, "[image]");

    const fake = await as(buyer.token).post(`/api/conversations/${conversationId}/messages`).attach("image", Buffer.from("<script>alert(1)</script>"), { filename: "x.png", contentType: "image/png" });
    assert.equal(fake.status, 422);
    const pdf = await as(buyer.token).post(`/api/conversations/${conversationId}/messages`).attach("image", Buffer.from("%PDF-1.4"), { filename: "x.pdf", contentType: "application/pdf" });
    assert.equal(pdf.status, 422);

    const foreign = await as(buyer.token).post(`/api/conversations/${conversationId}/messages`).send({ body: "And this?", advertisementId: otherStoreAd.id });
    assert.equal(foreign.status, 422);
    assert.equal(foreign.body.code, "ADVERTISEMENT_NOT_IN_STORE");
  });

  test("a retried send (same clientId) is stored once; empty and over-long messages are refused", async () => {
    const send = () => as(buyer.token).post(`/api/conversations/${conversationId}/messages`).send({ body: "Retry me", clientId: "retry-000001" });
    const first = await send();
    const second = await send();
    assert.equal(first.body.message.id, second.body.message.id);
    assert.equal(await prisma.chatMessage.count({ where: { body: "Retry me" } }), 1);

    assert.equal((await as(buyer.token).post(`/api/conversations/${conversationId}/messages`).send({ body: "   " })).body.code, "MESSAGE_EMPTY");
    assert.equal((await as(buyer.token).post(`/api/conversations/${conversationId}/messages`).send({ body: "x".repeat(2001) })).body.code, "MESSAGE_TOO_LONG");
  });

  test("read receipts and typing reach the other participant", async () => {
    const buyerSocket = open(buyer.token);
    await connected(buyerSocket);
    const seen = waitFor(buyerSocket, "conversation:read", { where: (e) => e.side === "seller" });
    assert.equal((await as(seller.token).post(`/api/conversations/${conversationId}/read`)).status, 204);
    const receipt = await seen;
    assert.equal(receipt.conversationId, conversationId);
    const thread = await as(buyer.token).get(`/api/conversations/${conversationId}`);
    assert.ok(new Date(thread.body.conversation.counterpartReadAt) >= new Date(Date.now() - 5000), "the buyer sees when the seller read");

    const sellerSocket = sockets[0];
    const typing = waitFor(sellerSocket, "typing");
    buyerSocket.emit("typing", { conversationId });
    assert.equal((await typing).userId, buyer.user.id);
  });

  test("payment talk outside SmartPlaze and phone numbers are flagged for staff", async () => {
    const res = await as(seller.token).post(`/api/conversations/${conversationId}/messages`).send({ body: "Send the money by Orange Money to 6 77 12 34 56, cheaper" });
    assert.equal(res.body.message.flagged, true);
    const clean = await as(seller.token).post(`/api/conversations/${conversationId}/messages`).send({ body: "The price is 25000 FCFA, delivery in Douala." });
    assert.equal(clean.body.message.flagged, false);
    const flagged = await as(cs.token).get("/api/admin/conversations?flagged=true");
    assert.deepEqual(flagged.body.items.map((c) => c.id), [conversationId]);
  });

  test("strangers can't read or write; staff can read (audited) but never write", async () => {
    assert.equal((await as(stranger.token).get(`/api/conversations/${conversationId}`)).status, 404);
    assert.equal((await as(stranger.token).get(`/api/conversations/${conversationId}/messages`)).status, 404);
    assert.equal((await as(stranger.token).post(`/api/conversations/${conversationId}/messages`).send({ body: "hi" })).status, 404);
    assert.equal((await as(stranger.token).get("/api/conversations")).body.items.length, 0);

    const list = await as(cs.token).get("/api/admin/conversations");
    assert.equal(list.status, 200);
    assert.equal(list.body.items[0].buyer.email, buyer.user.email);
    const detail = await as(cs.token).get(`/api/admin/conversations/${conversationId}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.conversation.seller.id, seller.user.id);
    const messages = await as(cs.token).get(`/api/admin/conversations/${conversationId}/messages`);
    assert.ok(messages.body.items.length >= 5);
    await eventually(async () => assert.ok(await prisma.auditLog.findFirst({ where: { action: "CONVERSATION_VIEWED", entityId: conversationId, actorId: cs.user.id } })));

    assert.equal((await as(accountant.token).get("/api/admin/conversations")).status, 403, "accountants don't read chats");
    assert.equal((await as(buyer.token).get("/api/admin/conversations")).status, 403);
    assert.equal((await as(cs.token).post(`/api/conversations/${conversationId}/messages`).send({ body: "staff" })).status, 404, "staff can't post in a conversation");
  });

  test("sockets need a valid token, and signing out closes them", async () => {
    await assert.rejects(connected(open("not-a-token")), /TOKEN_INVALID/);
    await assert.rejects(connected(open("")), /TOKEN_MISSING/);

    const session = await login(buyer.user.email);
    const socket = open(session.token);
    await connected(socket);
    const closed = new Promise((resolve) => socket.once("disconnect", resolve));
    assert.equal((await request(app).post("/api/auth/logout").set("Cookie", session.cookie).set("Authorization", `Bearer ${session.token}`)).status, 204);
    assert.equal(await closed, "io server disconnect");
    await assert.rejects(connected(open(session.token)), /TOKEN_REVOKED/, "the old token can't reconnect");
  });
});
