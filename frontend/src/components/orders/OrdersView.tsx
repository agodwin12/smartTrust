"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, Package, Search } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { ApiRequestError } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Order, OrderStatus, Paginated } from "@/types";
import { RequireAuth } from "@/components/auth/RequireAuth";
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

function OrderCard({ order, onChange }: { order: Order; onChange: (next: Order) => void }) {
  const t = useTranslations("orders");
  const locale = useLocale();
  const { authFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");

  const canConfirm = (order.status === "PAID" || order.status === "CONFIRMED") && !order.buyerConfirmedAt;
  const canDispute = order.status === "PAID";
  const image = order.advertisement?.images?.[0];

  const confirmReceipt = async () => {
    setBusy(true);
    try {
      const data = await authFetch<{ order: Order }>(`orders/${order.id}/confirm-receipt`, { method: "POST" });
      onChange({ ...order, ...data.order, advertisement: order.advertisement });
      toast.success(t("confirmed"));
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : t("notFound"));
    } finally {
      setBusy(false);
    }
  };

  const submitDispute = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await authFetch<{ order: Order }>(`orders/${order.id}/dispute`, { method: "POST", body: { reason } });
      onChange({ ...order, ...data.order, status: "DISPUTED", advertisement: order.advertisement });
      toast.success(t("disputeOpened"));
      setDisputeOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : t("notFound"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-2xl border border-border bg-surface">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-4 p-4 text-left">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-surface-hover">
          {image && <Image src={image} alt="" fill sizes="64px" className="object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{order.advertisement?.title ?? t("orderNumber", { id: order.id })}</p>
          <p className="text-xs text-foreground-muted">
            {t("orderNumber", { id: order.id.slice(-8).toUpperCase() })} · {t("placedOn", { date: formatDate(order.createdAt, locale) })} · {t("quantity", { count: order.quantity })}
          </p>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLES[order.status])}>{t(`status.${order.status}`)}</span>
            {order.paymentMethod === "CASH_ON_DELIVERY" && <span className="inline-flex rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">{t("paymentMethod.CASH_ON_DELIVERY")}</span>}
          </span>
        </div>
        <div className="text-right">
          <p className="font-script text-xl text-brand-blue dark:text-brand-blue-light">{formatPrice(order.totalAmount, locale)}</p>
          <ChevronDown className={cn("ml-auto size-4 text-foreground-muted transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          <p className="text-sm text-foreground-secondary">{t(`statusHelp.${order.status}`)}</p>
          <ul className="space-y-1.5 text-sm">
            <li className={cn("flex items-center gap-2", order.sellerConfirmedAt ? "text-success" : "text-foreground-muted")}>
              <CheckCircle2 className="size-4" /> {order.sellerConfirmedAt ? t("sellerConfirmed") : t("awaitingSeller")}
            </li>
            {order.buyerConfirmedAt && (
              <li className="flex items-center gap-2 text-success">
                <CheckCircle2 className="size-4" /> {t("buyerConfirmed")}
              </li>
            )}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Link href={`/account/orders/${order.id}`} className="inline-flex h-10 items-center rounded-xl bg-brand-blue px-3.5 text-sm font-semibold text-white hover:bg-brand-blue-light">
              {t("viewDetails")}
            </Link>
            {order.advertisement?.slug && (
              <Link href={`/products/${order.advertisement.slug}`} className="inline-flex h-10 items-center rounded-xl border border-border px-3.5 text-sm font-semibold text-foreground hover:border-brand-blue hover:text-brand-blue">
                {t("viewProduct")}
              </Link>
            )}
            {order.status === "PENDING_PAYMENT" && order.advertisement?.slug && (
              <Link href={`/checkout/${order.advertisement.slug}?qty=${order.quantity}&order=${order.id}`} className="inline-flex h-10 items-center rounded-xl bg-brand-orange px-3.5 text-sm font-semibold text-white hover:bg-brand-orange-light">
                {t("payNow")}
              </Link>
            )}
            {canConfirm && (
              <button type="button" onClick={confirmReceipt} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-xl bg-success px-3.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} {t("confirmReceipt")}
              </button>
            )}
            {canDispute && !disputeOpen && (
              <button type="button" onClick={() => setDisputeOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-danger/40 px-3.5 text-sm font-semibold text-danger hover:bg-danger/10">
                <AlertTriangle className="size-4" /> {t("openDispute")}
              </button>
            )}
          </div>
          {canConfirm && <p className="text-xs text-foreground-muted">{order.paymentMethod === "CASH_ON_DELIVERY" ? t("confirmReceiptHelpCod") : t("confirmReceiptHelp")}</p>}
          {disputeOpen && (
            <form onSubmit={submitDispute} className="space-y-3 rounded-xl border border-danger/30 bg-danger/5 p-4">
              <label className="block text-sm font-medium text-foreground">
                {t("disputeReason")}
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} required minLength={10} rows={4} placeholder={t("disputePlaceholder")} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm outline-none focus:border-brand-blue" />
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={busy || reason.trim().length < 10} className="inline-flex h-10 items-center rounded-xl bg-danger px-3.5 text-sm font-semibold text-white disabled:opacity-60">
                  {t("disputeSubmit")}
                </button>
                <button type="button" onClick={() => setDisputeOpen(false)} className="inline-flex h-10 items-center rounded-xl border border-border px-3.5 text-sm font-medium text-foreground-secondary">
                  ✕
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </li>
  );
}

function OrdersInner() {
  const t = useTranslations("orders");
  const { authFetch } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [lookup, setLookup] = useState<Order | null | "missing">(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await authFetch<Paginated<Order>>("orders/me", { params: { pageSize: 50 } });
      setOrders(data.items);
    } catch {
      setOrders([]);
    }
  }, [authFetch]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void load();
  }, [load]);

  const find = async (event: FormEvent) => {
    event.preventDefault();
    const id = query.trim();
    if (!id) return;
    try {
      const { order } = await authFetch<{ order: Order }>(`orders/${encodeURIComponent(id)}`);
      setLookup(order);
    } catch {
      setLookup("missing");
    }
  };

  const replace = (next: Order) => {
    setOrders((prev) => prev?.map((o) => (o.id === next.id ? next : o)) ?? prev);
    setLookup((prev) => (prev && prev !== "missing" && prev.id === next.id ? next : prev));
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground-secondary">{t("subtitle")}</p>
        <form onSubmit={find} className="mt-4 flex max-w-md gap-2">
          <label className="sr-only" htmlFor="order-lookup">
            {t("searchLabel")}
          </label>
          <input id="order-lookup" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPlaceholder")} className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3.5 text-sm outline-none focus:border-brand-blue" />
          <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white hover:bg-brand-blue-light">
            <Search className="size-4" /> {t("searchButton")}
          </button>
        </form>
      </div>
      <div>
        {lookup === "missing" && <p className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{t("notFound")}</p>}
        {lookup && lookup !== "missing" && (
          <ul className="mb-8">
            <OrderCard order={lookup} onChange={replace} />
          </ul>
        )}
        {orders === null ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-hover" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState icon={Package} title={t("empty.title")} description={t("empty.description")} action={{ label: t("empty.action"), href: "/products" }} />
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} onChange={replace} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export function OrdersView({ embedded = false }: { embedded?: boolean }) {
  if (embedded) return <OrdersInner />;
  return (
    <RequireAuth>
      <OrdersInner />
    </RequireAuth>
  );
}
