const storeService = require("../services/store.service");
const audit = require("../services/audit.service");

async function create(req, res) {
  const store = await storeService.createStore(req.user.id, req.body, req.files);
  audit.record(req, { action: "STORE_CREATED", entityType: "Store", entityId: store.id, metadata: { name: store.name } });
  res.status(201).json({ store });
}

async function getMine(req, res) {
  const store = await storeService.getMineDashboard(req.user.id);
  res.json({ store });
}

async function updateMine(req, res) {
  const store = await storeService.updateMine(req.user.id, req.body, req.files);
  audit.record(req, { action: "STORE_UPDATED", entityType: "Store", entityId: store.id, metadata: { fields: Object.keys(req.body) } });
  res.json({ store });
}

async function listAll(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
  res.json(await storeService.listAll({ page, pageSize, status: req.query.status, search: req.query.search }));
}

async function getBySlug(req, res) {
  const store = await storeService.getBySlug(req.params.slug);
  res.json({ store });
}

async function list(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
  const result = await storeService.listStores({ page, pageSize, search: req.query.search });
  res.json(result);
}

async function updateStatus(req, res) {
  const store = await storeService.updateStatus(req.params.id, req.body.status);
  audit.record(req, { action: "STORE_STATUS_CHANGED", entityType: "Store", entityId: store.id, metadata: { status: req.body.status } });
  res.json({ store });
}

module.exports = {
  listAll, create, getMine, updateMine, getBySlug, list, updateStatus };
