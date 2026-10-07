const chatService = require("../services/chat.service");
const audit = require("../services/audit.service");

const page = (req) => Math.max(parseInt(req.query.page, 10) || 1, 1);
const pageSize = (req, fallback) => Math.min(Math.max(parseInt(req.query.pageSize, 10) || fallback, 1), 100);

async function start(req, res) {
  const conversation = await chatService.start(req.user, req.body);
  res.status(201).json({ conversation });
}

async function list(req, res) {
  const role = ["buying", "selling"].includes(req.query.role) ? req.query.role : undefined;
  res.json(await chatService.list(req.user, { role, page: page(req), pageSize: pageSize(req, 30) }));
}

async function unread(req, res) {
  res.json({ total: await chatService.unreadTotal(req.user.id) });
}

async function get(req, res) {
  const { conversation, side } = await chatService.getForParticipant(req.params.id, req.user);
  res.json({ conversation: chatService.presentConversation(conversation, side) });
}

async function messages(req, res) {
  await chatService.getForParticipant(req.params.id, req.user);
  res.json(await chatService.listMessages(req.params.id, { before: req.query.before, limit: req.query.limit }));
}

async function send(req, res) {
  const access = await chatService.getForParticipant(req.params.id, req.user);
  const message = await chatService.send(access, req.user, req.body, req.file);
  res.status(201).json({ message });
}

async function read(req, res) {
  await chatService.markRead(await chatService.getForParticipant(req.params.id, req.user));
  res.status(204).send();
}

// ---------------------------------------------------------------- staff, read-only, every view audited

async function adminList(req, res) {
  res.json(await chatService.adminList({ search: req.query.search, flagged: req.query.flagged === "true", storeId: req.query.storeId, page: page(req), pageSize: pageSize(req, 20) }));
}

async function adminGet(req, res) {
  const conversation = await chatService.adminGet(req.params.id);
  audit.record(req, { action: "CONVERSATION_VIEWED", entityType: "Conversation", entityId: conversation.id, metadata: { storeId: conversation.store.id, buyerId: conversation.buyer.id } });
  res.json({ conversation });
}

async function adminMessages(req, res) {
  await chatService.adminGet(req.params.id);
  res.json(await chatService.listMessages(req.params.id, { before: req.query.before, limit: req.query.limit }));
}

module.exports = { start, list, unread, get, messages, send, read, adminList, adminGet, adminMessages };
