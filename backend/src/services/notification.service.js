const prisma = require("../config/prisma");
const logger = require("../config/logger");

/**
 * In-app notifications. Creating one is fire-and-forget: a notification must
 * never fail (or slow down) the money-moving action that triggered it, so every
 * writer swallows its own errors. Text is stored in English as a fallback for
 * staff tools; the frontend renders `type` + `data` in the user's language.
 */
function notify(userId, { type, title, body = null, data = null }) {
  if (!userId) return Promise.resolve(null);
  return prisma.notification
    .create({ data: { userId, type, title, body, data } })
    .catch((error) => {
      logger.warn({ type, userId, err: error.message }, "[notifications] could not create notification");
      return null;
    });
}

async function listMine(userId, { page = 1, pageSize = 20, unreadOnly = false } = {}) {
  const where = { userId, ...(unreadOnly && { isRead: false }) };
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { items, total, page, pageSize, unread };
}

async function unreadCount(userId) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

async function markRead(id, userId) {
  const { count } = await prisma.notification.updateMany({
    where: { id, userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return count;
}

async function markAllRead(userId) {
  const { count } = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return count;
}

module.exports = { notify, listMine, unreadCount, markRead, markAllRead };
