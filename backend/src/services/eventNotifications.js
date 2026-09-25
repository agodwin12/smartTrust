const prisma = require("../config/prisma");
const { notify } = require("./notification.service");
const logger = require("../config/logger");

/*
 * One function per business event. Each looks up who is involved and writes the
 * right notification(s). All calls are fire-and-forget from the caller's side.
 */

async function orderContext(orderId) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      buyerId: true,
      totalAmount: true,
      advertisement: {
        select: { title: true, slug: true, store: { select: { id: true, name: true, slug: true, ownerId: true } } },
      },
    },
  });
}

function payload(ctx, extra = {}) {
  return {
    orderId: ctx.id,
    productTitle: ctx.advertisement.title,
    productSlug: ctx.advertisement.slug,
    storeName: ctx.advertisement.store.name,
    storeSlug: ctx.advertisement.store.slug,
    amount: Number(ctx.totalAmount),
    ...extra,
  };
}

async function withOrder(orderId, fn) {
  try {
    const ctx = await orderContext(orderId);
    if (ctx) await fn(ctx);
  } catch (error) {
    logger.warn({ orderId, err: error.message }, "[notifications] order event failed");
  }
}

const orderPaid = (orderId) =>
  withOrder(orderId, (ctx) =>
    Promise.all([
      notify(ctx.buyerId, {
        type: "PAYMENT_CONFIRMED",
        title: `Payment received for ${ctx.advertisement.title}`,
        body: "Your money is held in escrow until you confirm delivery.",
        data: payload(ctx),
      }),
      notify(ctx.advertisement.store.ownerId, {
        type: "NEW_ORDER",
        title: `New paid order: ${ctx.advertisement.title}`,
        body: "Deliver it and confirm delivery to get paid.",
        data: payload(ctx),
      }),
    ])
  );

/** Cash on delivery: the order is confirmed straight away — buyer gets a receipt, seller a to-do. */
const codOrderPlaced = (orderId) =>
  withOrder(orderId, (ctx) =>
    Promise.all([
      notify(ctx.buyerId, {
        type: "ORDER_CONFIRMED",
        title: `Order confirmed: ${ctx.advertisement.title}`,
        body: `Pay ${Number(ctx.totalAmount)} XAF in cash when you receive it.`,
        data: payload(ctx, { paymentMethod: "CASH_ON_DELIVERY" }),
      }),
      notify(ctx.advertisement.store.ownerId, {
        type: "NEW_ORDER",
        title: `New cash-on-delivery order: ${ctx.advertisement.title}`,
        body: `Deliver it, collect ${Number(ctx.totalAmount)} XAF in cash, then confirm delivery.`,
        data: payload(ctx, { paymentMethod: "CASH_ON_DELIVERY" }),
      }),
    ])
  );

const orderCancelled = (orderId, cancelledBy, reason) =>
  withOrder(orderId, (ctx) => {
    const recipients = cancelledBy === "BUYER" ? [ctx.advertisement.store.ownerId] : cancelledBy === "SELLER" ? [ctx.buyerId] : [ctx.buyerId, ctx.advertisement.store.ownerId];
    return Promise.all(
      recipients.map((userId) =>
        notify(userId, {
          type: "ORDER_CANCELLED",
          title: `Order cancelled: ${ctx.advertisement.title}`,
          body: reason || null,
          data: payload(ctx, { cancelledBy }),
        })
      )
    );
  });

const deliveryConfirmed = (orderId) =>
  withOrder(orderId, (ctx) =>
    notify(ctx.buyerId, {
      type: "DELIVERY_CONFIRMED",
      title: `${ctx.advertisement.store.name} confirmed delivery of ${ctx.advertisement.title}`,
      body: "Check the item, then confirm receipt to release the payment.",
      data: payload(ctx),
    })
  );

const receiptConfirmed = (orderId) =>
  withOrder(orderId, (ctx) =>
    notify(ctx.advertisement.store.ownerId, {
      type: "RECEIPT_CONFIRMED",
      title: `Buyer confirmed receipt of ${ctx.advertisement.title}`,
      data: payload(ctx),
    })
  );

const orderCompleted = (orderId) =>
  withOrder(orderId, (ctx) =>
    Promise.all([
      notify(ctx.advertisement.store.ownerId, {
        type: "ESCROW_RELEASED",
        title: `${Number(ctx.totalAmount)} XAF released to your wallet for ${ctx.advertisement.title}`,
        body: "You can withdraw it to Mobile Money from your wallet.",
        data: payload(ctx),
      }),
      notify(ctx.buyerId, {
        type: "ORDER_COMPLETED",
        title: `Order completed: ${ctx.advertisement.title}`,
        body: "Thanks for buying on Smart Market — you can now review the seller.",
        data: payload(ctx),
      }),
    ])
  );

const disputeCreated = (orderId, raisedById) =>
  withOrder(orderId, (ctx) => {
    const otherParty = raisedById === ctx.buyerId ? ctx.advertisement.store.ownerId : ctx.buyerId;
    return notify(otherParty, {
      type: "DISPUTE_CREATED",
      title: `A dispute was opened on ${ctx.advertisement.title}`,
      body: "The order is frozen while our team reviews it.",
      data: payload(ctx),
    });
  });

/** outcome: "RELEASED" (seller wins) or "REFUNDED" (buyer wins) */
const disputeResolved = (orderId, outcome) =>
  withOrder(orderId, (ctx) =>
    Promise.all([
      notify(ctx.buyerId, {
        type: outcome === "REFUNDED" ? "ORDER_REFUNDED" : "DISPUTE_RESOLVED",
        title:
          outcome === "REFUNDED" ? `Refund approved for ${ctx.advertisement.title}` : `Dispute resolved on ${ctx.advertisement.title}`,
        data: payload(ctx, { outcome }),
      }),
      notify(ctx.advertisement.store.ownerId, {
        type: "DISPUTE_RESOLVED",
        title: `Dispute resolved on ${ctx.advertisement.title}`,
        data: payload(ctx, { outcome }),
      }),
    ])
  );

async function withdrawalUpdated(withdrawal, status) {
  try {
    const store = await prisma.store.findUnique({ where: { id: withdrawal.storeId }, select: { ownerId: true, slug: true } });
    if (!store) return;
    const failed = status !== "COMPLETED";
    await notify(store.ownerId, {
      type: failed ? "WITHDRAWAL_FAILED" : "WITHDRAWAL_COMPLETED",
      title: failed
        ? `Withdrawal of ${Number(withdrawal.amount)} XAF failed`
        : `Withdrawal of ${Number(withdrawal.amount)} XAF completed`,
      body: failed ? "The amount has been credited back to your wallet." : null,
      data: { withdrawalId: withdrawal.id, amount: Number(withdrawal.amount), status, storeSlug: store.slug },
    });
  } catch (error) {
    logger.warn({ err: error.message }, "[notifications] withdrawal event failed");
  }
}

async function subscriptionActivated(subscription) {
  try {
    const store = await prisma.store.findUnique({ where: { id: subscription.storeId }, select: { ownerId: true, slug: true } });
    if (!store) return;
    await notify(store.ownerId, {
      type: "SUBSCRIPTION_ACTIVATED",
      title: `${subscription.plan?.name ?? "Your"} plan is active`,
      data: { subscriptionId: subscription.id, planName: subscription.plan?.name ?? null, storeSlug: store.slug },
    });
  } catch (error) {
    logger.warn({ err: error.message }, "[notifications] subscription event failed");
  }
}

/** Buyer refund settled by the payment provider (COMPLETED) or definitively failed. */
async function refundUpdated(refund, status) {
  await withOrder(refund.orderId, (ctx) => {
    const sent = status === "COMPLETED";
    return notify(ctx.buyerId, {
      type: sent ? "REFUND_SENT" : "REFUND_FAILED",
      title: sent ? `Refund of ${Number(refund.amount)} XAF sent` : `Refund of ${Number(refund.amount)} XAF could not be sent`,
      body: sent ? `Sent to ${refund.phoneNumber}.` : "Our team has been alerted and will contact you.",
      data: payload(ctx, { refundId: refund.id, phoneNumber: refund.phoneNumber, status }),
    });
  });
}

async function subscriptionExpiring(subscription, daysLeft) {
  try {
    await notify(subscription.store.ownerId, {
      type: "SUBSCRIPTION_EXPIRING",
      title: `${subscription.plan?.name ?? "Your"} plan expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      body: "Renew to keep your listings visible.",
      data: { subscriptionId: subscription.id, planName: subscription.plan?.name ?? null, expiresAt: subscription.expiresAt, days: daysLeft, storeSlug: subscription.store.slug },
    });
  } catch (error) {
    logger.warn({ err: error.message }, "[notifications] subscription expiring event failed");
  }
}

async function subscriptionExpired(subscription, hiddenListings) {
  try {
    await notify(subscription.store.ownerId, {
      type: "SUBSCRIPTION_EXPIRED",
      title: `${subscription.plan?.name ?? "Your"} plan has expired`,
      body: hiddenListings > 0 ? `${hiddenListings} listing${hiddenListings === 1 ? " is" : "s are"} no longer visible until you renew.` : null,
      data: { subscriptionId: subscription.id, planName: subscription.plan?.name ?? null, count: hiddenListings, storeSlug: subscription.store.slug },
    });
    if (hiddenListings > 0) {
      await notify(subscription.store.ownerId, {
        type: "ADVERTISEMENT_EXPIRED",
        title: `${hiddenListings} listing${hiddenListings === 1 ? "" : "s"} hidden from the marketplace`,
        body: "Renew your plan to publish them again.",
        data: { subscriptionId: subscription.id, count: hiddenListings, storeSlug: subscription.store.slug },
      });
    }
  } catch (error) {
    logger.warn({ err: error.message }, "[notifications] subscription expired event failed");
  }
}

async function reviewReceived(review, { ownerId, productTitle, storeSlug }) {
  await notify(ownerId, {
    type: "REVIEW_RECEIVED",
    title: `New ${review.rating}-star review on ${productTitle}`,
    body: review.comment,
    data: { reviewId: review.id, orderId: review.orderId, rating: review.rating, productTitle, storeSlug },
  });
}

/* ---- flash-deal campaigns ---- */

const flashData = (campaign, extra = {}) => ({
  campaignId: campaign.id,
  campaignName: campaign.name,
  startsAt: campaign.startsAt,
  endsAt: campaign.endsAt,
  ...extra,
});

/** A seller's application was approved (possibly with a corrected price) or rejected. */
async function flashApplicationReviewed(item, campaign) {
  try {
    const ownerId = item.advertisement?.store?.ownerId;
    const approved = item.status === "APPROVED";
    await notify(ownerId, {
      type: approved ? "FLASH_APPLICATION_APPROVED" : "FLASH_APPLICATION_REJECTED",
      title: approved ? `${item.advertisement.title} is in ${campaign.name}` : `${item.advertisement.title} was not accepted for ${campaign.name}`,
      body: item.reviewNote ?? null,
      data: flashData(campaign, { productTitle: item.advertisement.title, productSlug: item.advertisement.slug, campaignPrice: Number(item.campaignPrice), reviewNote: item.reviewNote ?? null }),
    });
  } catch (error) {
    logger.warn({ err: error.message }, "[notifications] flash review event failed");
  }
}

/** One notice per store when a campaign starts (prices applied) or ends (prices restored). */
async function flashCampaignMoved(campaign, items, live) {
  try {
    const perOwner = new Map();
    for (const item of items) {
      const ownerId = item.advertisement?.store?.ownerId;
      if (ownerId) perOwner.set(ownerId, (perOwner.get(ownerId) ?? 0) + 1);
    }
    await Promise.all(
      [...perOwner].map(([ownerId, count]) =>
        notify(ownerId, {
          type: live ? "FLASH_CAMPAIGN_LIVE" : "FLASH_CAMPAIGN_ENDED",
          title: live ? `${campaign.name} is live: ${count} of your listings are on flash sale` : `${campaign.name} has ended: your prices are back to normal`,
          data: flashData(campaign, { count }),
        })
      )
    );
  } catch (error) {
    logger.warn({ err: error.message }, "[notifications] flash campaign event failed");
  }
}

/** A seller opened a store: every active staff member gets a review request. */
async function storeSubmitted(store) {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ACCOUNTANT", "CUSTOMER_SERVICE"] }, status: "ACTIVE" },
      select: { id: true },
    });
    await Promise.all(
      staff.map((member) =>
        notify(member.id, {
          type: "STORE_SUBMITTED",
          title: `New store to review: ${store.name}`,
          body: store.location ?? null,
          data: { storeId: store.id, storeName: store.name, storeSlug: store.slug },
        })
      )
    );
  } catch (error) {
    logger.warn({ err: error.message }, "[notifications] store submitted event failed");
  }
}

/** The owner learns the decision in-app and by email (email failures never block the review). */
async function storeReviewed(store, approved) {
  try {
    const owner = await prisma.user.findUnique({ where: { id: store.ownerId }, select: { id: true, email: true, firstName: true } });
    if (!owner) return;
    await notify(owner.id, {
      type: approved ? "STORE_APPROVED" : "STORE_REJECTED",
      title: approved ? `${store.name} is approved` : `${store.name} was not approved`,
      body: approved ? null : store.reviewNote ?? null,
      data: { storeId: store.id, storeName: store.name, storeSlug: store.slug, reviewNote: store.reviewNote ?? null },
    });
    const { frontendUrl } = require("../config/env");
    await require("./email.service")
      .sendStoreDecisionEmail({ to: owner.email, firstName: owner.firstName, storeName: store.name, approved, reason: store.reviewNote, dashboardUrl: `${frontendUrl}/seller` })
      .catch((error) => logger.warn({ err: error.message, storeId: store.id }, "[notifications] store decision email failed"));
  } catch (error) {
    logger.warn({ err: error.message }, "[notifications] store reviewed event failed");
  }
}

const flashCampaignLive = (campaign, items) => flashCampaignMoved(campaign, items, true);
const flashCampaignEnded = (campaign, items) => flashCampaignMoved(campaign, items, false);

module.exports = {
  storeSubmitted,
  storeReviewed,
  flashApplicationReviewed,
  flashCampaignLive,
  flashCampaignEnded,
  codOrderPlaced,
  orderCancelled,
  refundUpdated,
  subscriptionExpiring,
  subscriptionExpired,
  orderPaid,
  deliveryConfirmed,
  receiptConfirmed,
  orderCompleted,
  disputeCreated,
  disputeResolved,
  withdrawalUpdated,
  subscriptionActivated,
  reviewReceived,
};
