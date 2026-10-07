const { Server } = require("socket.io");
const prisma = require("../config/prisma");
const logger = require("../config/logger");
const { corsOrigin } = require("../config/env");
const { verifyAccessToken } = require("../services/token.service");

/**
 * Real-time delivery for the buyer ↔ seller chat (Socket.IO on the API's HTTP server).
 *
 * The connection only PUSHES events; every message is written through the REST API first
 * (validation, rate limits, storage), then pushed here. A socket authenticates with the same
 * access token as the API (sent in the handshake's `auth`, never in a URL), the account must be
 * active and the token not revoked; each user joins the room `user:<id>`. Signing out
 * disconnects every socket of the account (token.service → disconnectUser).
 */
let io = null;
const TYPING_MIN_INTERVAL_MS = 1500;

const room = (userId) => `user:${userId}`;

async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || !token) return next(new Error("TOKEN_MISSING"));
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, status: true, tokenVersion: true, role: true } });
    if (!user || user.status !== "ACTIVE") return next(new Error("ACCOUNT_INACTIVE"));
    if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) return next(new Error("TOKEN_REVOKED"));
    socket.data.userId = user.id;
    socket.data.conversations = new Map(); // conversationId → other participant's userId (checked once)
    socket.data.lastTypingAt = 0;
    next();
  } catch {
    next(new Error("TOKEN_INVALID"));
  }
}

/** The other participant of a conversation, if this user is one of the two (null otherwise). */
async function counterpartOf(socket, conversationId) {
  if (socket.data.conversations.has(conversationId)) return socket.data.conversations.get(conversationId);
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { buyerId: true, store: { select: { ownerId: true } } } });
  let other = null;
  if (conversation?.buyerId === socket.data.userId) other = conversation.store.ownerId;
  else if (conversation?.store.ownerId === socket.data.userId) other = conversation.buyerId;
  socket.data.conversations.set(conversationId, other);
  return other;
}

function init(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
    // Small frames only: messages travel through REST, the socket carries notifications.
    maxHttpBufferSize: 16 * 1024,
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });
  io.use(authenticateSocket);
  io.on("connection", (socket) => {
    socket.join(room(socket.data.userId));
    // "Typing…" goes to the other participant only, at most every 1.5 s per socket.
    socket.on("typing", async (data) => {
      const conversationId = typeof data?.conversationId === "string" ? data.conversationId.slice(0, 40) : null;
      const now = Date.now();
      if (!conversationId || now - socket.data.lastTypingAt < TYPING_MIN_INTERVAL_MS) return;
      socket.data.lastTypingAt = now;
      try {
        const other = await counterpartOf(socket, conversationId);
        if (other) io.to(room(other)).emit("typing", { conversationId, userId: socket.data.userId });
      } catch (err) {
        logger.warn({ err: err.message }, "typing relay failed");
      }
    });
  });
  logger.info("Real-time chat ready (Socket.IO)");
  return io;
}

/** Pushes an event to every open tab/device of these users. No-op when real-time is off (tests, scripts). */
function emitToUsers(userIds, event, payload) {
  if (!io) return;
  for (const id of new Set(userIds.filter(Boolean))) io.to(room(id)).emit(event, payload);
}

/** Whether the user has at least one connected socket right now. */
async function isOnline(userId) {
  if (!io) return false;
  const sockets = await io.in(room(userId)).fetchSockets();
  return sockets.length > 0;
}

/** Closes every socket of a user (sign-out, suspension). */
function disconnectUser(userId) {
  if (io) io.in(room(userId)).disconnectSockets(true);
}

async function close() {
  if (io) await io.close();
  io = null;
}

module.exports = { init, emitToUsers, isOnline, disconnectUser, close };
