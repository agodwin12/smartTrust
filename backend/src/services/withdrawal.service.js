const crypto = require("crypto");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const kpayService = require("./kpay.service");
const { mapStatus } = require("./payment.service");
const auditService = require("./audit.service");
const eventNotifications = require("./eventNotifications");

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

async function request(storeId, { provider, phoneNumber, amount }) {
  // Generated up front (not derived from the row's own id) so the unique
  // externalId can be set on insert — no placeholder value that two concurrent
  // requests could collide on.
  const externalId = `wd-${crypto.randomBytes(12).toString("hex")}`;

  // A plain "read balance, then decrement" is check-then-act: under READ
  // COMMITTED (Postgres's default), two concurrent requests can both read the
  // same balance before either writes, and both pass the check. Instead, the
  // check IS the write — `balance: { gte: amount }` in the WHERE clause means
  // the conditional UPDATE only matches (and only decrements) if the balance is
  // still sufficient at the moment it actually runs; Postgres serializes
  // concurrent UPDATEs to the same row, so a second concurrent withdrawal sees
  // the already-decremented balance and correctly fails the same check.
  const withdrawal = await prisma.$transaction(async (tx) => {
    const { count } = await tx.wallet.updateMany({
      where: { storeId, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });

    if (count === 0) {
      throw new ApiError(422, "Insufficient wallet balance for this withdrawal.", "INSUFFICIENT_BALANCE");
    }

    return tx.withdrawal.create({
      data: { storeId, amount, externalId, provider: "KPAY", phoneNumber, status: "PENDING" },
    });
  });

  let kpayResponse;
  try {
    kpayResponse = await kpayService.initWithdrawal({
      amount,
      provider,
      phoneNumber,
      externalId,
      description: `Smart Market seller payout — ${storeId}`,
      metadata: { storeId, withdrawalId: withdrawal.id },
    });
  } catch (err) {
    // K-Pay rejected the request outright — give the reserved funds back immediately.
    await prisma.$transaction([
      prisma.wallet.update({ where: { storeId }, data: { balance: { increment: amount } } }),
      prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: "FAILED", failureReason: err.message },
      }),
    ]);
    throw err;
  }

  return prisma.withdrawal.update({
    where: { id: withdrawal.id },
    data: {
      providerPayoutId: kpayResponse.id,
      providerReference: kpayResponse.reference,
      status: mapStatus(kpayResponse.status),
    },
  });
}

/**
 * Same idempotent-and-race-safe pattern as payment.service.js#applyStatusUpdate:
 * the conditional updateMany's `count` is what decides whether THIS call is the
 * one that gets to credit the wallet back — a concurrent duplicate webhook for
 * the same FAILED/CANCELLED payout can't refund the reservation twice.
 */
async function applyStatusUpdate({ externalId, providerPayoutId, providerReference, status, failureReason }) {
  const withdrawal = await prisma.withdrawal.findUnique({ where: { externalId } });
  if (!withdrawal) return null;
  if (TERMINAL_STATUSES.has(withdrawal.status)) return withdrawal;

  const nextStatus = mapStatus(status);

  const wonRace = await prisma.$transaction(async (tx) => {
    const { count } = await tx.withdrawal.updateMany({
      where: { id: withdrawal.id, status: { notIn: [...TERMINAL_STATUSES] } },
      data: {
        status: nextStatus,
        providerPayoutId: providerPayoutId ?? withdrawal.providerPayoutId,
        providerReference: providerReference ?? withdrawal.providerReference,
        failureReason: failureReason ?? null,
        ...(nextStatus === "COMPLETED" && { completedAt: new Date() }),
      },
    });
    return count === 1;
  });

  if (wonRace) {
    auditService.recordSystem({
      action: `WITHDRAWAL_${nextStatus}`,
      entityType: "Withdrawal",
      entityId: withdrawal.id,
      metadata: { storeId: withdrawal.storeId, amount: Number(withdrawal.amount), providerReference, failureReason },
    });
  }

  if (wonRace && ["COMPLETED", "FAILED", "CANCELLED"].includes(nextStatus)) {
    void eventNotifications.withdrawalUpdated(withdrawal, nextStatus);
  }

  // The payout never went through — give the reserved balance back (only once).
  if (wonRace && (nextStatus === "FAILED" || nextStatus === "CANCELLED")) {
    await prisma.wallet.update({
      where: { storeId: withdrawal.storeId },
      data: { balance: { increment: withdrawal.amount } },
    });
  }

  return prisma.withdrawal.findUnique({ where: { id: withdrawal.id } });
}

async function refreshStatus(withdrawalId, storeId) {
  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
  if (!withdrawal) throw new ApiError(404, "Withdrawal not found.", "WITHDRAWAL_NOT_FOUND");
  if (withdrawal.storeId !== storeId) throw new ApiError(403, "This withdrawal does not belong to you.", "FORBIDDEN");

  if (!TERMINAL_STATUSES.has(withdrawal.status)) {
    const live = await kpayService.getWithdrawalStatus(withdrawal.providerPayoutId || withdrawal.externalId);
    await applyStatusUpdate({
      externalId: withdrawal.externalId,
      providerPayoutId: live.id,
      providerReference: live.reference,
      status: live.status,
      failureReason: live.failureReason,
    });
  }

  return prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
}

async function listMine(storeId, { page = 1, pageSize = 20 } = {}) {
  const where = { storeId };
  const [items, total] = await Promise.all([
    prisma.withdrawal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.withdrawal.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

async function listAll({ page = 1, pageSize = 20, status, storeId } = {}) {
  const where = { ...(status && { status }), ...(storeId && { storeId }) };
  const [items, total] = await Promise.all([
    prisma.withdrawal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { store: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.withdrawal.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

module.exports = { request, applyStatusUpdate, refreshStatus, listMine, listAll };
