const service = require("../services/checkout.service");
const advertisementService = require("../services/advertisement.service");
const audit = require("../services/audit.service");

const requesterOf = (req) => ({ user: req.user ?? null, token: (typeof req.query.token === "string" && req.query.token) || req.body?.token || null });

async function create(req, res) {
  const group = await service.create({ user: req.user ?? null, guest: req.body.guest, items: req.body.items, paymentMethod: req.body.paymentMethod, deliveryAddress: req.body.deliveryAddress, deliveryPhone: req.body.deliveryPhone });
  audit.record(req, {
    action: "CHECKOUT_CREATED",
    entityType: "CheckoutGroup",
    entityId: group.id,
    actorId: group.buyerId,
    metadata: { reference: group.reference, itemCount: group.itemCount, totalAmount: Number(group.totalAmount), paymentMethod: group.paymentMethod, guest: group.isGuest },
  });
  await advertisementService.invalidateListingCache().catch(() => {});
  res.status(201).json({ group });
}

async function get(req, res) {
  const group = await service.getForRequester(req.params.id, requesterOf(req));
  res.json({ group });
}

async function lookup(req, res) {
  const group = await service.lookup(req.body);
  res.json({ group });
}

async function pay(req, res) {
  const result = await service.pay(req.params.id, requesterOf(req), req.body);
  audit.record(req, { action: "CHECKOUT_PAYMENT_STARTED", entityType: "CheckoutGroup", entityId: req.params.id, actorId: result.group.buyerId, metadata: { amount: Number(result.payment.amount), operator: req.body.provider } });
  res.status(202).json(result);
}

async function confirmReceipt(req, res) {
  const order = await service.confirmReceipt(req.params.id, req.params.orderId, requesterOf(req));
  res.json({ order });
}

async function cancelLine(req, res) {
  const order = await service.cancelLine(req.params.id, req.params.orderId, requesterOf(req), req.body.reason);
  res.json({ order });
}

async function listMine(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
  res.json(await service.listMine(req.user.id, { page, pageSize }));
}

module.exports = { create, get, lookup, pay, confirmReceipt, cancelLine, listMine };
