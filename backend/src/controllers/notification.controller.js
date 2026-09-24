const notificationService = require("../services/notification.service");

async function listMine(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
  const unreadOnly = req.query.unread === "true" || req.query.unread === "1";
  res.json(await notificationService.listMine(req.user.id, { page, pageSize, unreadOnly }));
}

async function unreadCount(req, res) {
  res.json({ unread: await notificationService.unreadCount(req.user.id) });
}

async function markRead(req, res) {
  const updated = await notificationService.markRead(req.params.id, req.user.id);
  res.json({ ok: true, updated });
}

async function markAllRead(req, res) {
  const updated = await notificationService.markAllRead(req.user.id);
  res.json({ ok: true, updated });
}

module.exports = { listMine, unreadCount, markRead, markAllRead };
