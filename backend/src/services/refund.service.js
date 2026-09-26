const crypto = require("crypto");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const logger = require("../config/logger");
const kpayService = require("./kpay.service");
const { mapStatus } = require("./payment.service");
const auditService = require("./audit.service");
const eventNotifications = require("./eventNotifications");

/**
 * Buyer refunds: real money back to the Mobile Money number the buyer paid with.
 *
 * Flow: a dispute is settled in the buyer's favour → escrow flips to REFUNDED and the
 * order to REFUNDED (escrow.service) → `initiate()` creates ONE Refund row per order and
 * asks K-Pay for a payout from the platform wallet (the same API sellers' withdrawals use).
 * K-Pay then reports the outcome through the webhook (`applyStatusUpdate`) or the
 * payout-status job polls it. If K-Pay rejects the request outright (maintenance, bad
 * credentials, unknown operator) the refund is stored as FAILED with the reason so staff
 * can fix the details and `retry()` — the dispute resolution itself never rolls back.
 */

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
const newExternalId = () => `rf-${crypto.randomBytes(12).toString("hex")}`;

const listInclude = {
  order: {
    select: {
      id: true,
      status: true,
      buyer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      advertisement: { select: { title: true, slug: true, store: { select: { name: true, slug: true } } } },
    },
  },
};

async function initiate(orderId, { initiatedById = null } = {}) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true, escrow: true, refund: true } });
  if (!order) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");
  if (order.refund) return order.refund; // idempotent: one refund per order
  if (order.escrow?.status !== "REFUNDED") throw new ApiError(409, "The order's escrow is not marked as refunded.", "ESCROW_NOT_REFUNDED");
  if (!order.payment || order.payment.status !== "COMPLETED") throw new ApiError(409, "This order has no completed payment to refund.", "PAYMENT_NOT_FOUND");

  const refund = await prisma.refund.create({
    data: {
      orderId,
      amount: order.escrow.amount,
      currency: order.payment.currency ?? "XAF",
      provider: "KPAY",
      operator: order.payment.operator,
      phoneNumber: order.payment.phoneNumber ?? "",
      externalId: newExternalId(),
      status: "PENDING",
      initiatedById,
    },
  });
  return send(refund);
}

/** Asks K-Pay for the payout. Never throws: a rejected request becomes a FAILED refund. */
async function send(refund) {
  let operator = refund.operator;
  if (!operator && refund.phoneNumber) {
    // Payments recorded before the operator was stored: ask K-Pay which network the number is on.
    try {
      const prediction = await kpayService.predictProvider(refund.phoneNumber);
      operator = prediction?.provider ?? prediction?.data?.provider ?? null;
    } catch (err) {
      logger.warn({ refundId: refund.id, err: err.message }, "Could not predict the Mobile Money operator for a refund");
    }
  }
  if (!operator || !refund.phoneNumber) {
    return markFailed(refund, "Mobile Money operator or number is missing — set them and retry.", operator);
  }

  let response;
  try {
    response = await kpayService.initWithdrawal({
      amount: Number(refund.amount),
      provider: operator,
      phoneNumber: refund.phoneNumber,
      externalId: refund.externalId,
      description: `SmartPlaze refund — order ${refund.orderId}`,
      metadata: { orderId: refund.orderId, refundId: refund.id, kind: "refund" },
    });
  } catch (err) {
    return markFailed(refund, err.message, operator);
  }

  const status = mapStatus(response.status);
  const updated = await prisma.refund.update({
    where: { id: refund.id },
    data: {
      operator,
      attempts: { increment: 1 },
      providerPayoutId: response.id ?? null,
      providerReference: response.reference ?? null,
      status,
      failureReason: null,
      ...(status === "COMPLETED" && { completedAt: new Date() }),
    },
  });
  auditService.recordSystem({
    action: "REFUND_INITIATED",
    entityType: "Refund",
    entityId: refund.id,
    metadata: { orderId: refund.orderId, amount: Number(refund.amount), operator, providerReference: response.reference ?? null, status },
  });
  if (status === "COMPLETED") void eventNotifications.refundUpdated(updated, "COMPLETED");
  return updated;
}

async function markFailed(refund, reason, operator) {
  const updated = await prisma.refund.update({
    where: { id: refund.id },
    data: { status: "FAILED", failureReason: reason, attempts: { increment: 1 }, ...(operator && { operator }) },
  });
  logger.warn({ refundId: refund.id, orderId: refund.orderId, reason }, "Refund payout could not be initiated");
  auditService.recordSystem({ action: "REFUND_FAILED", entityType: "Refund", entityId: refund.id, metadata: { orderId: refund.orderId, reason, stage: "initiation" } });
  return updated;
}

/**
 * Applies a status reported by K-Pay (webhook or poll). Same race-safe conditional update
 * as payments/withdrawals: only the call that flips the row notifies the buyer.
 */
async function applyStatusUpdate({ externalId, providerPayoutId, providerReference, status, failureReason }) {
  const refund = await prisma.refund.findUnique({ where: { externalId } });
  if (!refund) return null;
  if (TERMINAL_STATUSES.has(refund.status)) return refund;

  const nextStatus = mapStatus(status);
  const { count } = await prisma.refund.updateMany({
    where: { id: refund.id, status: { notIn: [...TERMINAL_STATUSES] } },
    data: {
      status: nextStatus,
      providerPayoutId: providerPayoutId ?? refund.providerPayoutId,
      providerReference: providerReference ?? refund.providerReference,
      failureReason: failureReason ?? null,
      ...(nextStatus === "COMPLETED" && { completedAt: new Date() }),
    },
  });

  const updated = await prisma.refund.findUnique({ where: { id: refund.id } });
  if (count === 1 && TERMINAL_STATUSES.has(nextStatus)) {
    auditService.recordSystem({
      action: `REFUND_${nextStatus}`,
      entityType: "Refund",
      entityId: refund.id,
      metadata: { orderId: refund.orderId, amount: Number(refund.amount), providerReference, failureReason, stage: "provider" },
    });
    void eventNotifications.refundUpdated(updated, nextStatus);
  }
  return updated;
}

/** Staff re-issues a failed payout, optionally correcting the operator / number first. */
async function retry(id, { operator, phoneNumber, actorId } = {}) {
  const refund = await prisma.refund.findUnique({ where: { id } });
  if (!refund) throw new ApiError(404, "Refund not found.", "REFUND_NOT_FOUND");
  if (!["FAILED", "CANCELLED"].includes(refund.status)) {
    throw new ApiError(409, "Only a failed or cancelled refund can be retried.", "REFUND_NOT_RETRYABLE");
  }
  const reset = await prisma.refund.update({
    where: { id },
    data: {
      ...(operator && { operator }),
      ...(phoneNumber && { phoneNumber }),
      externalId: newExternalId(), // K-Pay needs a fresh idempotency key per attempt
      status: "PENDING",
      failureReason: null,
      providerPayoutId: null,
      providerReference: null,
      initiatedById: actorId ?? refund.initiatedById,
    },
  });
  return send(reset);
}

/** Pulls the live status from K-Pay for a refund still in flight. */
async function refreshStatus(id) {
  const refund = await prisma.refund.findUnique({ where: { id } });
  if (!refund) throw new ApiError(404, "Refund not found.", "REFUND_NOT_FOUND");
  if (TERMINAL_STATUSES.has(refund.status) || !refund.providerPayoutId) return refund;
  const live = await kpayService.getWithdrawalStatus(refund.providerPayoutId);
  return applyStatusUpdate({
    externalId: refund.externalId,
    providerPayoutId: live.id,
    providerReference: live.reference,
    status: live.status,
    failureReason: live.failureReason,
  });
}

async function listAll({ page = 1, pageSize = 20, status } = {}) {
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.refund.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: listInclude }),
    prisma.refund.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

async function getById(id) {
  const refund = await prisma.refund.findUnique({ where: { id }, include: listInclude });
  if (!refund) throw new ApiError(404, "Refund not found.", "REFUND_NOT_FOUND");
  return refund;
}

module.exports = { initiate, applyStatusUpdate, retry, refreshStatus, listAll, getById, TERMINAL_STATUSES };
