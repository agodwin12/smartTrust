const prisma = require("../config/prisma");
const orderService = require("../services/order.service");
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

async function create(req, res) {
  const order = await orderService.create(req.user.id, req.body);
  audit.record(req, {
    action: "ORDER_CREATED",
    entityType: "Order",
    entityId: order.id,
    metadata: { advertisementId: order.advertisementId, quantity: order.quantity, totalAmount: Number(order.totalAmount) },
  });
  res.status(201).json({ order });
}

async function pay(req, res) {
  const result = await orderService.pay(req.params.id, req.user.id, req.body);
  audit.record(req, {
    action: "ORDER_PAYMENT_INITIATED",
    entityType: "Order",
    entityId: req.params.id,
    metadata: { provider: req.body.provider, paymentId: result.payment.id },
  });
  res.status(201).json(result);
}

async function confirmDelivery(req, res) {
  const order = await orderService.confirmDelivery(req.params.id, req.user.id);
  audit.record(req, { action: "ORDER_DELIVERY_CONFIRMED", entityType: "Order", entityId: order.id });
  if (order.status === "COMPLETED") {
    audit.record(req, { action: "ESCROW_RELEASED", entityType: "Order", entityId: order.id, metadata: { via: "dual-confirmation" } });
  }
  res.json({ order });
}

async function confirmReceipt(req, res) {
  const order = await orderService.confirmReceipt(req.params.id, req.user.id);
  audit.record(req, { action: "ORDER_RECEIPT_CONFIRMED", entityType: "Order", entityId: order.id });
  if (order.status === "COMPLETED") {
    audit.record(req, { action: "ESCROW_RELEASED", entityType: "Order", entityId: order.id, metadata: { via: "dual-confirmation" } });
  }
  res.json({ order });
}

async function cancel(req, res) {
  const order = await orderService.cancel(req.params.id, req.user, req.body.reason);
  audit.record(req, { action: "ORDER_CANCELLED", entityType: "Order", entityId: order.id, metadata: { by: order.cancelledBy, reason: order.cancelReason, paymentMethod: order.paymentMethod } });
  res.json({ order });
}

async function raiseDispute(req, res) {
  const dispute = await orderService.raiseDispute(req.params.id, req.user, req.body.reason);
  audit.record(req, { action: "DISPUTE_RAISED", entityType: "Order", entityId: req.params.id, metadata: { disputeId: dispute.id } });
  res.status(201).json({ dispute });
}

async function getById(req, res) {
  const order = await orderService.getById(req.params.id, req.user);
  res.json({ order });
}

async function listMine(req, res) {
  const result = await orderService.listMineAsBuyer(req.user.id, pagination(req));
  res.json(result);
}

async function listForStore(req, res) {
  const storeId = await myStoreId(req.user.id);
  const result = await orderService.listForStore(storeId, pagination(req));
  res.json(result);
}

async function listAll(req, res) {
  const { status, buyerId, storeId } = req.query;
  const result = await orderService.listAll({ ...pagination(req), status, buyerId, storeId });
  res.json(result);
}

module.exports = { create, pay, confirmDelivery, confirmReceipt, raiseDispute, getById, listMine, listForStore, listAll, cancel };
