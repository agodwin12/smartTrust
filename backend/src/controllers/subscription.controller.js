const prisma = require("../config/prisma");
const subscriptionService = require("../services/subscription.service");
const audit = require("../services/audit.service");
const ApiError = require("../utils/ApiError");

async function myStoreId(userId) {
  const store = await prisma.store.findUnique({ where: { ownerId: userId } });
  if (!store) throw new ApiError(404, "You need a store before subscribing to a plan.", "STORE_NOT_FOUND");
  return store.id;
}

async function checkout(req, res) {
  const storeId = await myStoreId(req.user.id);
  const result = await subscriptionService.checkout(storeId, req.body);
  audit.record(req, {
    action: "SUBSCRIPTION_CHECKOUT",
    entityType: "Subscription",
    entityId: result.subscription.id,
    metadata: { storeId, planId: req.body.planId, provider: req.body.provider, paymentId: result.payment.id },
  });
  res.status(201).json(result);
}

async function getMine(req, res) {
  const storeId = await myStoreId(req.user.id);
  const subscription = await subscriptionService.getMine(storeId);
  res.json({ subscription });
}

async function refreshStatus(req, res) {
  const storeId = await myStoreId(req.user.id);
  const subscription = await subscriptionService.refreshStatus(req.params.id, storeId);
  res.json({ subscription });
}

module.exports = { checkout, getMine, refreshStatus };
