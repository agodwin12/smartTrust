const prisma = require("../config/prisma");
const redis = require("../config/redis");
const logger = require("../config/logger");
const { frontendUrl } = require("../config/env");
const ApiError = require("../utils/ApiError");
const storage = require("./storage.service");
const realtime = require("../realtime");

/**
 * Buyer ↔ seller chat. A buyer opens (or reopens) the one conversation they have with a store,
 * usually from a product page; the store's owner replies. Messages carry text, a photo, or a
 * product card. Every write happens here first and is then pushed over Socket.IO (realtime/).
 *
 * Escrow protection: a message that mentions a phone number or paying outside SmartPlaze is
 * flagged. Both participants see a warning under it and staff can filter flagged conversations.
 */
const MAX_BODY = 2000;
const PREVIEW_LENGTH = 140;
const IMAGE_PREVIEW = "[image]";
const PRODUCT_PREVIEW = "[product]";
const EMAIL_EVERY_SECONDS = 60 * 60; // at most one "new message" email per conversation and hour

// Cameroonian phone numbers (with or without +237 and separators) and off-platform payment talk.
const PHONE = /(?:\+?237[\s.-]*)?\b[62](?:[\s.-]*\d){8}\b/;
const OFF_PLATFORM =
  /\b(momo|mobile\s*money|orange\s*money|western\s*union|money\s*gram|whats\s*app|pay(?:ment)?\s+(?:me\s+)?direct(?:ly)?|outside\s+(?:the\s+)?(?:app|site|smartplaze)|pa(?:yer|yez|ie)\s+directement|hors\s+(?:du\s+)?(?:site|smartplaze)|d[ée]p[ôo]t\s+direct)\b/i;
const isRisky = (text) => Boolean(text) && (PHONE.test(text) || OFF_PLATFORM.test(text));

const cardSelect = { id: true, title: true, slug: true, price: true, images: true, status: true };
const conversationInclude = {
  store: { select: { id: true, name: true, slug: true, logoUrl: true, ownerId: true, status: true } },
  buyer: { select: { id: true, firstName: true, lastName: true } },
  advertisement: { select: cardSelect },
};

const card = (ad) => ad && { id: ad.id, title: ad.title, slug: ad.slug, price: ad.price, image: Array.isArray(ad.images) ? ad.images[0] ?? null : null, available: ad.status === "PUBLISHED" };

/** Which side of the conversation this user is on, or null when they are not part of it. */
function sideOf(conversation, userId) {
  if (conversation.buyerId === userId) return "buyer";
  if (conversation.store.ownerId === userId) return "seller";
  return null;
}

/** A conversation as one participant sees it (or staff, with `side` null). */
function present(conversation, side) {
  return {
    id: conversation.id,
    side,
    store: { id: conversation.store.id, name: conversation.store.name, slug: conversation.store.slug, logoUrl: conversation.store.logoUrl },
    buyer: { id: conversation.buyer.id, name: `${conversation.buyer.firstName} ${conversation.buyer.lastName}`.trim() },
    advertisement: card(conversation.advertisement),
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    unread: side === "buyer" ? conversation.buyerUnread : side === "seller" ? conversation.sellerUnread : 0,
    // When the OTHER side last read the thread ("Seen" under my messages).
    counterpartReadAt: side === "buyer" ? conversation.sellerLastReadAt : side === "seller" ? conversation.buyerLastReadAt : null,
    buyerLastReadAt: side === null ? conversation.buyerLastReadAt : undefined,
    sellerLastReadAt: side === null ? conversation.sellerLastReadAt : undefined,
    flagged: side === null ? conversation.flagged : undefined,
    storeAvailable: conversation.store.status === "ACTIVE",
    createdAt: conversation.createdAt,
  };
}

const presentMessage = (m) => ({
  id: m.id,
  conversationId: m.conversationId,
  senderId: m.senderId,
  body: m.body,
  imageUrl: m.imageUrl,
  advertisement: card(m.advertisement),
  flagged: m.flagged,
  clientId: m.clientId,
  createdAt: m.createdAt,
});

/** Opens the buyer's conversation with a store (from a product or the store page). Only buyers start chats. */
async function start(user, { advertisementId, storeId }) {
  let store;
  let ad = null;
  if (advertisementId) {
    ad = await prisma.advertisement.findUnique({ where: { id: advertisementId }, select: { id: true, store: { select: { id: true, ownerId: true, status: true } } } });
    if (!ad) throw new ApiError(404, "This product no longer exists.", "ADVERTISEMENT_NOT_FOUND");
    store = ad.store;
  } else {
    store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, ownerId: true, status: true } });
  }
  if (!store || store.status !== "ACTIVE") throw new ApiError(404, "This store is not available.", "STORE_NOT_FOUND");
  if (store.ownerId === user.id) throw new ApiError(422, "This is your own store.", "OWN_STORE");

  const conversation = await prisma.conversation.upsert({
    where: { buyerId_storeId: { buyerId: user.id, storeId: store.id } },
    create: { buyerId: user.id, storeId: store.id, advertisementId: ad?.id ?? null },
    update: ad ? { advertisementId: ad.id } : {},
    include: conversationInclude,
  });
  return present(conversation, "buyer");
}

/** The participant's conversations, newest activity first (empty conversations are not listed). */
async function list(user, { role, page = 1, pageSize = 30 } = {}) {
  const mine = [{ buyerId: user.id }, { store: { ownerId: user.id } }];
  const where = {
    lastMessagePreview: { not: null },
    ...(role === "buying" ? { buyerId: user.id } : role === "selling" ? { store: { ownerId: user.id } } : { OR: mine }),
  };
  const [rows, total] = await Promise.all([
    prisma.conversation.findMany({ where, orderBy: { lastMessageAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: conversationInclude }),
    prisma.conversation.count({ where }),
  ]);
  return { items: rows.map((c) => present(c, sideOf(c, user.id))), total, page, pageSize };
}

/** Unread messages across all of the user's conversations (header badge). */
async function unreadTotal(userId) {
  const [asBuyer, asSeller] = await Promise.all([
    prisma.conversation.aggregate({ where: { buyerId: userId }, _sum: { buyerUnread: true } }),
    prisma.conversation.aggregate({ where: { store: { ownerId: userId } }, _sum: { sellerUnread: true } }),
  ]);
  return (asBuyer._sum.buyerUnread ?? 0) + (asSeller._sum.sellerUnread ?? 0);
}

/** Loads a conversation for one of its two participants; anyone else gets a 404 (no existence leak). */
async function getForParticipant(id, user) {
  const conversation = await prisma.conversation.findUnique({ where: { id }, include: conversationInclude });
  const side = conversation && sideOf(conversation, user.id);
  if (!side) throw new ApiError(404, "Conversation not found.", "CONVERSATION_NOT_FOUND");
  return { conversation, side };
}

/** Messages oldest → newest, in pages of `limit`, going back in time with `before` (a message id). */
async function listMessages(conversationId, { before, limit = 30 } = {}) {
  const take = Math.min(Math.max(Number(limit) || 30, 1), 100);
  let cursor;
  if (before) {
    const anchor = await prisma.chatMessage.findFirst({ where: { id: before, conversationId }, select: { createdAt: true, id: true } });
    if (anchor) cursor = anchor;
  }
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId, ...(cursor && { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    include: { advertisement: { select: cardSelect } },
  });
  const hasMore = rows.length > take;
  return { items: rows.slice(0, take).reverse().map(presentMessage), hasMore };
}

/**
 * Sends a message (text, a photo, and/or a product card) as one of the two participants.
 * A retried send with the same clientId returns the stored message instead of a duplicate.
 */
async function send({ conversation, side }, user, { body, clientId, advertisementId }, file) {
  if (conversation.store.status !== "ACTIVE") throw new ApiError(409, "This store is not available right now.", "STORE_UNAVAILABLE");
  const text = typeof body === "string" ? body.trim() : "";
  if (text.length > MAX_BODY) throw new ApiError(422, `Messages can be up to ${MAX_BODY} characters.`, "MESSAGE_TOO_LONG");
  if (!text && !file && !advertisementId) throw new ApiError(422, "Write a message or add a photo.", "MESSAGE_EMPTY");

  if (clientId) {
    const existing = await prisma.chatMessage.findUnique({ where: { senderId_clientId: { senderId: user.id, clientId } }, include: { advertisement: { select: cardSelect } } });
    if (existing) {
      if (existing.conversationId !== conversation.id) throw new ApiError(409, "Duplicate message id.", "DUPLICATE_CLIENT_ID");
      return presentMessage(existing);
    }
  }

  let ad = null;
  if (advertisementId) {
    ad = await prisma.advertisement.findFirst({ where: { id: advertisementId, storeId: conversation.storeId }, select: { id: true } });
    if (!ad) throw new ApiError(422, "This product isn't from this store.", "ADVERTISEMENT_NOT_IN_STORE");
  }
  // Photos go through the same checks as every other upload (real JPEG/PNG/WebP bytes, ≤ 5 MB).
  const imageUrl = file ? await storage.uploadImage(file, "chat") : null;
  const flagged = isRisky(text);
  const now = new Date();
  const other = side === "buyer" ? "seller" : "buyer";

  let message;
  try {
    [message] = await prisma.$transaction([
      prisma.chatMessage.create({
        data: { conversationId: conversation.id, senderId: user.id, body: text || null, imageUrl, advertisementId: ad?.id ?? null, flagged, clientId: clientId || null },
        include: { advertisement: { select: cardSelect } },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: now,
          lastMessagePreview: text ? text.slice(0, PREVIEW_LENGTH) : imageUrl ? IMAGE_PREVIEW : PRODUCT_PREVIEW,
          [`${other}Unread`]: { increment: 1 },
          // Sending means the sender has read everything so far.
          [`${side}Unread`]: 0,
          [`${side}LastReadAt`]: now,
          ...(flagged && { flagged: true }),
          ...(ad && { advertisementId: ad.id }),
        },
      }),
    ]);
  } catch (err) {
    if (imageUrl) await storage.deleteImageByUrl(imageUrl);
    // Two retries racing with the same clientId: the loser returns the winner's message.
    if (err.code === "P2002" && clientId) {
      const existing = await prisma.chatMessage.findUnique({ where: { senderId_clientId: { senderId: user.id, clientId } }, include: { advertisement: { select: cardSelect } } });
      if (existing) return presentMessage(existing);
    }
    throw err;
  }

  const payload = presentMessage(message);
  const recipientId = side === "buyer" ? conversation.store.ownerId : conversation.buyerId;
  realtime.emitToUsers([conversation.buyerId, conversation.store.ownerId], "message:new", { conversationId: conversation.id, message: payload });
  void emailIfOffline(conversation, recipientId, user, payload);
  return payload;
}

/** Marks the conversation read for this participant and tells the other side ("Seen"). */
async function markRead({ conversation, side }) {
  const at = new Date();
  await prisma.conversation.update({ where: { id: conversation.id }, data: { [`${side}Unread`]: 0, [`${side}LastReadAt`]: at } });
  realtime.emitToUsers([conversation.buyerId, conversation.store.ownerId], "conversation:read", { conversationId: conversation.id, side, at });
}

/** One email per conversation per hour, and only when the recipient has no open SmartPlaze tab. */
async function emailIfOffline(conversation, recipientId, sender, message) {
  try {
    if (await realtime.isOnline(recipientId)) return;
    const claimed = await redis.set(`chat:mail:${conversation.id}:${recipientId}`, "1", "EX", EMAIL_EVERY_SECONDS, "NX").catch(() => null);
    if (claimed !== "OK") return;
    const recipient = await prisma.user.findUnique({ where: { id: recipientId }, select: { email: true, firstName: true } });
    if (!recipient?.email) return;
    const senderName = conversation.buyerId === sender.id ? `${sender.firstName} ${sender.lastName}`.trim() : conversation.store.name;
    await require("./email.service").sendChatMessageEmail({
      to: recipient.email,
      firstName: recipient.firstName,
      senderName,
      preview: message.body ? message.body.slice(0, 200) : message.imageUrl ? "Sent you a photo." : "Shared a product with you.",
      url: `${frontendUrl}/messages/${conversation.id}`,
    });
  } catch (err) {
    logger.warn({ conversationId: conversation.id, err: err.message }, "chat email not sent");
  }
}

// ---------------------------------------------------------------- staff (read-only)

async function adminList({ search, flagged, storeId, page = 1, pageSize = 20 } = {}) {
  const term = search?.trim();
  const where = {
    lastMessagePreview: { not: null },
    ...(flagged && { flagged: true }),
    ...(storeId && { storeId }),
    ...(term && {
      OR: [
        { store: { name: { contains: term, mode: "insensitive" } } },
        { buyer: { email: { contains: term, mode: "insensitive" } } },
        { buyer: { firstName: { contains: term, mode: "insensitive" } } },
        { buyer: { lastName: { contains: term, mode: "insensitive" } } },
      ],
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.conversation.findMany({ where, orderBy: { lastMessageAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { ...conversationInclude, buyer: { select: { id: true, firstName: true, lastName: true, email: true } }, _count: { select: { messages: true } } } }),
    prisma.conversation.count({ where }),
  ]);
  return {
    items: rows.map((c) => ({ ...present(c, null), buyer: { id: c.buyer.id, name: `${c.buyer.firstName} ${c.buyer.lastName}`.trim(), email: c.buyer.email }, messageCount: c._count.messages })),
    total,
    page,
    pageSize,
  };
}

async function adminGet(id) {
  const conversation = await prisma.conversation.findUnique({ where: { id }, include: { ...conversationInclude, buyer: { select: { id: true, firstName: true, lastName: true, email: true } }, store: { select: { ...conversationInclude.store.select, owner: { select: { id: true, firstName: true, lastName: true, email: true } } } } } });
  if (!conversation) throw new ApiError(404, "Conversation not found.", "CONVERSATION_NOT_FOUND");
  const owner = conversation.store.owner;
  return {
    ...present(conversation, null),
    buyer: { id: conversation.buyer.id, name: `${conversation.buyer.firstName} ${conversation.buyer.lastName}`.trim(), email: conversation.buyer.email },
    seller: { id: owner.id, name: `${owner.firstName} ${owner.lastName}`.trim(), email: owner.email },
  };
}

module.exports = { start, list, unreadTotal, getForParticipant, listMessages, send, markRead, adminList, adminGet, isRisky, presentConversation: present };
