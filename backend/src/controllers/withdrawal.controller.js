const prisma = require("../config/prisma");
const withdrawalService = require("../services/withdrawal.service");
const audit = require("../services/audit.service");
const ApiError = require("../utils/ApiError");

async function myStoreId(userId) {
  const store = await prisma.store.findUnique({ where: { ownerId: userId } });
  if (!store) throw new ApiError(404, "You don't have a store.", "STORE_NOT_FOUND");
  return store.id;
}

function pagination(req) {
  return {
    page: Math.max(parseInt(req.query.page, 10) || 1, 1),
    pageSize: Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100),
  };
}

async function request(req, res) {
  const storeId = await myStoreId(req.user.id);
  const withdrawal = await withdrawalService.request(storeId, req.body);
  audit.record(req, {
    action: "WITHDRAWAL_REQUESTED",
    entityType: "Withdrawal",
    entityId: withdrawal.id,
    metadata: { storeId, amount: req.body.amount, provider: req.body.provider },
  });
  res.status(201).json({ withdrawal });
}

async function listMine(req, res) {
  const storeId = await myStoreId(req.user.id);
  const result = await withdrawalService.listMine(storeId, pagination(req));
  res.json(result);
}

async function listAll(req, res) {
  const result = await withdrawalService.listAll({ ...pagination(req), status: req.query.status, storeId: req.query.storeId });
  res.json(result);
}

async function refreshStatus(req, res) {
  const storeId = await myStoreId(req.user.id);
  const withdrawal = await withdrawalService.refreshStatus(req.params.id, storeId);
  res.json({ withdrawal });
}

module.exports = { request, listMine, listAll, refreshStatus };
