import type { AppNotification } from "@/types";

/** Where a notification takes the user when opened. */
export function notificationHref(n: AppNotification): string {
  const d = n.data ?? {};
  switch (n.type) {
    case "PAYMENT_CONFIRMED":
    case "DELIVERY_CONFIRMED":
    case "ORDER_COMPLETED":
    case "ORDER_REFUNDED":
    case "REFUND_SENT":
    case "REFUND_FAILED":
    case "ORDER_CONFIRMED":
      return d.orderId ? `/account/orders/${d.orderId}` : "/account/orders";
    case "ORDER_CANCELLED":
      // The seller is told when the buyer cancels, and vice versa.
      return d.cancelledBy === "BUYER" ? (d.orderId ? `/seller/orders/${d.orderId}` : "/seller/orders") : d.orderId ? `/account/orders/${d.orderId}` : "/account/orders";
    case "NEW_ORDER":
    case "RECEIPT_CONFIRMED":
    case "ESCROW_RELEASED":
      return d.orderId ? `/seller/orders/${d.orderId}` : "/seller/orders";
    case "DISPUTE_CREATED":
    case "DISPUTE_RESOLVED":
      return d.orderId ? `/account/orders/${d.orderId}` : "/account/orders";
    case "REVIEW_RECEIVED":
      return d.storeSlug ? `/stores/${d.storeSlug}` : "/account";
    case "WITHDRAWAL_COMPLETED":
    case "WITHDRAWAL_FAILED":
      return "/seller/wallet";
    case "SUBSCRIPTION_ACTIVATED":
    case "SUBSCRIPTION_EXPIRING":
    case "SUBSCRIPTION_EXPIRED":
      return "/seller/subscription";
    case "ADVERTISEMENT_EXPIRED":
      return "/seller/listings";
    default:
      return "/account/notifications";
  }
}

/** Values for the localized title/body templates (messages → notifications.types.<TYPE>). */
export function notificationValues(n: AppNotification, formatAmount: (value: number) => string) {
  const d = n.data ?? {};
  return {
    product: d.productTitle ?? "",
    store: d.storeName ?? "",
    amount: typeof d.amount === "number" ? formatAmount(d.amount) : "",
    plan: d.planName ?? "",
    rating: d.rating ?? 0,
    count: typeof d.count === "number" ? d.count : 0,
    days: typeof d.days === "number" ? d.days : 0,
    phone: d.phoneNumber ?? "",
    comment: n.body ?? "",
  };
}

/** Fired on window whenever the inbox changes locally, so the header bell refreshes without waiting for its poll. */
export const NOTIFICATIONS_CHANGED_EVENT = "sm:notifications-changed";
export const announceNotificationsChanged = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
