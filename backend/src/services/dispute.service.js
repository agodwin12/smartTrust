const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const escrowService = require("./escrow.service");
const eventNotifications = require("./eventNotifications");
const refundService = require("./refund.service");
const logger = require("../config/logger");

async function list({ page = 1, pageSize = 20, status } = {}) {
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        order: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
            buyer: { select: { id: true, firstName: true, lastName: true } },
            advertisement: { select: { title: true, slug: true, store: { select: { id: true, name: true, slug: true } } } },
          },
        },
        raisedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    }),
    prisma.dispute.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

async function getById(id) {
  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          buyer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          advertisement: { select: { id: true, title: true, slug: true, images: true, store: { select: { id: true, name: true, slug: true, ownerId: true, contactPhone: true } } } },
          escrow: true,
          payment: { select: { status: true, provider: true, operator: true, phoneNumber: true, providerReference: true } },
          refund: true,
        },
      },
      raisedBy: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
  });
  if (!dispute) throw new ApiError(404, "Dispute not found.", "DISPUTE_NOT_FOUND");
  return dispute;
}

async function updateStatus(id, { status, resolution }) {
  const dispute = await getById(id);
  return prisma.dispute.update({
    where: { id: dispute.id },
    data: {
      ...(status && { status }),
      ...(resolution !== undefined && { resolution }),
      ...(status === "RESOLVED" || status === "REJECTED" ? { resolvedAt: new Date() } : {}),
    },
  });
}

/** Admin sides with the seller — releases the held escrow to their wallet as normal. */
async function releaseToSeller(id, resolution) {
  const dispute = await getById(id);
  await escrowService.release(dispute.order.id);
  void eventNotifications.disputeResolved(dispute.order.id, "RELEASED");
  return prisma.dispute.update({
    where: { id: dispute.id },
    data: { status: "RESOLVED", resolution, resolvedAt: new Date() },
  });
}

/** Admin sides with the buyer — marks the order refunded. No K-Pay payout to the buyer yet (see escrow.service.js). */
async function refundBuyer(id, resolution, actorId = null) {
  const dispute = await getById(id);
  await escrowService.markRefunded(dispute.order.id);
  void eventNotifications.disputeResolved(dispute.order.id, "REFUNDED");
  const resolved = await prisma.dispute.update({
    where: { id: dispute.id },
    data: { status: "RESOLVED", resolution, resolvedAt: new Date() },
  });

  // Real money back to the buyer. A payout the provider refuses is stored as a FAILED
  // refund for staff to retry — it never undoes the resolution above.
  let refund = null;
  try {
    refund = await refundService.initiate(dispute.order.id, { initiatedById: actorId });
  } catch (err) {
    logger.warn({ disputeId: id, orderId: dispute.order.id, err: err.message }, "Refund could not be initiated after dispute resolution");
  }
  return { ...resolved, refund };
}

module.exports = { list, getById, updateStatus, releaseToSeller, refundBuyer };
