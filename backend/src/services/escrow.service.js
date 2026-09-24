const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

/**
 * Releases a HELD escrow to the seller's wallet and marks the order COMPLETED.
 * Shared by the normal dual-confirmation path (order.service.js) and an admin
 * resolving a dispute in the seller's favor (dispute.service.js) — money only
 * ever moves through this one function.
 *
 * Safe against a double release: seller-confirms and buyer-confirms both call
 * this via maybeComplete(), and if both requests land at nearly the same time,
 * both could read status="HELD" before either has written. The fix is the
 * conditional `updateMany({ where: { status: "HELD" } })` below — Postgres
 * serializes concurrent UPDATEs to the same row, so only ONE of the two calls
 * ever sees `count === 1`; the other sees `count === 0` and does nothing
 * further, instead of crediting the wallet a second time.
 */
async function release(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { escrow: true, advertisement: { select: { storeId: true } } },
  });

  if (!order) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");
  if (!order.escrow) {
    throw new ApiError(409, "This order has no funds held in escrow to release.", "ESCROW_NOT_HELD");
  }

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.escrowTransaction.updateMany({
      where: { id: order.escrow.id, status: "HELD" },
      data: { status: "RELEASED", releasedAt: new Date() },
    });

    if (count === 0) return; // already released by a concurrent call — nothing more to do

    await tx.order.update({ where: { id: orderId }, data: { status: "COMPLETED" } });
    await tx.wallet.update({
      where: { storeId: order.advertisement.storeId },
      data: { balance: { increment: order.escrow.amount } },
    });
  });
}

/**
 * Settles the escrow in the buyer's favour: escrow → REFUNDED, order → REFUNDED.
 * The money itself goes back through refund.service.js (a K-Pay payout to the
 * buyer's Mobile Money number), which dispute.service.js triggers right after this.
 *
 * Same conditional-update guard as release() — a double-click or two admins
 * acting on the same dispute can't process it twice.
 */
async function markRefunded(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { escrow: true } });

  if (!order) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");
  if (!order.escrow) {
    throw new ApiError(409, "This order has no funds held in escrow to refund.", "ESCROW_NOT_HELD");
  }

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.escrowTransaction.updateMany({
      where: { id: order.escrow.id, status: "HELD" },
      data: { status: "REFUNDED", releasedAt: new Date() },
    });

    if (count === 0) return; // already settled by a concurrent call

    await tx.order.update({ where: { id: orderId }, data: { status: "REFUNDED" } });
  });
}

module.exports = { release, markRefunded };
