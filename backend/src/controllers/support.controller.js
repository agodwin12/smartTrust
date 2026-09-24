const supportService = require("../services/support.service");

async function contact(req, res) {
  await supportService.submitContact(req.body, req.ip);
  res.status(201).json({ ok: true });
}

async function subscribe(req, res) {
  await supportService.subscribeNewsletter(req.body);
  res.status(201).json({ ok: true });
}

function pagination(req, defaultSize = 20) {
  return {
    page: Math.max(parseInt(req.query.page, 10) || 1, 1),
    pageSize: Math.min(Math.max(parseInt(req.query.pageSize, 10) || defaultSize, 1), 100),
  };
}

async function listMessages(req, res) {
  res.json(await supportService.listMessages({ ...pagination(req), unhandledOnly: req.query.unhandled === "true" }));
}

async function markHandled(req, res) {
  const message = await supportService.markHandled(req.params.id, req.body?.handled !== false);
  res.json({ message });
}

async function listSubscribers(req, res) {
  res.json(await supportService.listSubscribers(pagination(req, 50)));
}

module.exports = { contact, subscribe, listMessages, markHandled, listSubscribers };
