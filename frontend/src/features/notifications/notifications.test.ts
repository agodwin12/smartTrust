import { describe, expect, it } from "vitest";
import type { AppNotification } from "@/types";
import { notificationHref, notificationValues } from "./notifications";

const note = (type: AppNotification["type"], data: AppNotification["data"] = null, body: string | null = null): AppNotification => ({
  id: "n1",
  type,
  title: "t",
  body,
  data,
  isRead: false,
  createdAt: "2026-09-23T00:00:00.000Z",
  readAt: null,
});

describe("notification routing", () => {
  it("sends buyers to their order and sellers to theirs", () => {
    expect(notificationHref(note("PAYMENT_CONFIRMED", { orderId: "o1" }))).toBe("/account/orders/o1");
    expect(notificationHref(note("REFUND_SENT", { orderId: "o1" }))).toBe("/account/orders/o1");
    expect(notificationHref(note("REFUND_FAILED", null))).toBe("/account/orders");
    expect(notificationHref(note("NEW_ORDER", { orderId: "o2" }))).toBe("/seller/orders/o2");
    expect(notificationHref(note("ESCROW_RELEASED", { orderId: "o2" }))).toBe("/seller/orders/o2");
  });

  it("routes seller account events to the seller area", () => {
    expect(notificationHref(note("WITHDRAWAL_FAILED"))).toBe("/seller/wallet");
    expect(notificationHref(note("SUBSCRIPTION_EXPIRED"))).toBe("/seller/subscription");
    expect(notificationHref(note("SUBSCRIPTION_EXPIRING"))).toBe("/seller/subscription");
    expect(notificationHref(note("ADVERTISEMENT_EXPIRED"))).toBe("/seller/listings");
    expect(notificationHref(note("REVIEW_RECEIVED", { storeSlug: "my-store" }))).toBe("/stores/my-store");
  });

  it("exposes template values with safe defaults", () => {
    const values = notificationValues(note("REFUND_SENT", { productTitle: "Watch", amount: 120000, phoneNumber: "2376", count: 2, days: 3 }, "body"), (v) => `${v} F`);
    expect(values).toMatchObject({ product: "Watch", amount: "120000 F", phone: "2376", count: 2, days: 3, comment: "body" });
    const empty = notificationValues(note("NEW_ORDER"), (v) => String(v));
    expect(empty).toMatchObject({ product: "", store: "", amount: "", count: 0, days: 0, rating: 0 });
  });
});
