"use client";

import { CheckCircle2, Loader2, Phone, ShoppingBag } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Order, OrderStatus, Paginated } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";
import { EmptyState } from "@/components/ui/EmptyState";

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-warning/15 text-warning",
  CONFIRMED: "bg-brand-blue/10 text-brand-blue dark:text-brand-blue-light",
  PAID: "bg-brand-blue/10 text-brand-blue dark:text-brand-blue-light",
  COMPLETED: "bg-success/15 text-success",
  CANCELLED: "bg-foreground-muted/15 text-foreground-muted",
  DISPUTED: "bg-danger/10 text-danger",
  REFUNDED: "bg-foreground-muted/15 text-foreground-secondary",
};

export function SellerOrdersView() {
  const t = useTranslations("sellerArea.orders");
  const to = useTranslations("orders");
  const locale = useLocale();
  const { authFetch } = useAuth();
  const describeError = useAuthError();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    () =>
      authFetch<Paginated<Order>>("orders/store", { params: { pageSize: 50 } })
        .then((r) => setOrders(r.items))
        .catch(() => setOrders([])),
    [authFetch]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const confirmDelivery = async (id: string) => {
    setBusyId(id);
    try {
      await authFetch(`orders/${id}/confirm-delivery`, { method: "POST" });
      toast.success(t("delivered"));
      await load();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground-secondary">{t("subtitle")}</p>
      </div>
      {orders === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-hover" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState icon={ShoppingBag} title={t("empty.title")} description={t("empty.description")} action={{ label: to("empty.action"), href: "/seller/listings/new" }} />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const cod = order.paymentMethod === "CASH_ON_DELIVERY";
            const canConfirm = (order.status === "PAID" || order.status === "CONFIRMED") && !order.sellerConfirmedAt;
            return (
              <li key={order.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start gap-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-surface-hover">
                    {order.advertisement?.images?.[0] && <Image src={order.advertisement.images[0]} alt="" fill sizes="64px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/seller/orders/${order.id}`} className="block truncate text-sm font-semibold text-foreground hover:text-brand-blue">
                      {order.advertisement?.title}
                    </Link>
                    <p className="text-xs text-foreground-muted">
                      {to("orderNumber", { id: order.id.slice(-8).toUpperCase() })} · {formatDate(order.createdAt, locale)} · {to("quantity", { count: order.quantity })}
                    </p>
                    {order.buyer && (
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-foreground-secondary">
                        <span>
                          {t("buyer")}: <span className="font-semibold text-foreground">{order.buyer.firstName} {order.buyer.lastName}</span>
                        </span>
                        {order.buyer.phone && (
                          <a href={`tel:${order.buyer.phone}`} className="inline-flex items-center gap-1 font-semibold text-brand-blue hover:underline">
                            <Phone className="size-3" /> {order.buyer.phone}
                          </a>
                        )}
                      </p>
                    )}
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLES[order.status])}>{to(`status.${order.status}`)}</span>
                      {cod && <span className="inline-flex rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">{to("cod.collect", { amount: formatPrice(order.totalAmount, locale) })}</span>}
                    </span>
                    {order.deliveryAddress && (
                      <p className="mt-1 text-xs text-foreground-secondary">
                        {t("deliverTo")}: <span className="text-foreground">{order.deliveryAddress}</span>
                        {order.deliveryPhone && ` · ${order.deliveryPhone}`}
                      </p>
                    )}
                    {(order.status === "PAID" || order.status === "CONFIRMED") && order.sellerConfirmedAt && <p className="mt-1 text-xs text-foreground-muted">{t("awaitingBuyer")}</p>}
                  </div>
                  <p className="font-bold text-xl text-brand-blue dark:text-brand-blue-light">{formatPrice(order.totalAmount, locale)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/seller/orders/${order.id}`} className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:border-brand-blue hover:text-brand-blue">
                    {to("viewDetails")}
                  </Link>
                  {canConfirm && (
                    <button type="button" disabled={busyId === order.id} onClick={() => confirmDelivery(order.id)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-success px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60">
                      {busyId === order.id ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} {cod ? t("confirmDeliveryCod") : t("confirmDelivery")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
