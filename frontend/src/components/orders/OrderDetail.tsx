"use client";

import { AlertTriangle, ArrowLeft, BadgeCheck, Banknote, CheckCircle2, Circle, Loader2, Mail, MapPin, Phone, Star, Truck, XCircle } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { ApiRequestError } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types";
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

function timeline(order: Order) {
  const cod = order.paymentMethod === "CASH_ON_DELIVERY";
  const paid = order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED";
  const steps: { key: string; done: boolean; date?: string | null }[] = [
    { key: "created", done: true, date: order.createdAt },
    cod ? { key: "confirmed", done: true, date: order.createdAt } : { key: "paid", done: paid, date: paid ? order.payment?.createdAt : null },
    { key: "sellerConfirmed", done: !!order.sellerConfirmedAt, date: order.sellerConfirmedAt },
    { key: "buyerConfirmed", done: !!order.buyerConfirmedAt, date: order.buyerConfirmedAt },
  ];
  if (order.status === "DISPUTED") steps.push({ key: "disputed", done: true, date: order.disputes?.[0]?.createdAt });
  else if (order.status === "REFUNDED") steps.push({ key: "refunded", done: true, date: order.updatedAt });
  else if (order.status === "CANCELLED") steps.push({ key: "cancelled", done: true, date: order.updatedAt });
  else steps.push({ key: cod ? "cashPaid" : "completed", done: order.status === "COMPLETED", date: order.status === "COMPLETED" ? order.escrow?.releasedAt ?? order.updatedAt : null });
  return steps;
}

function ReviewForm({ orderId, onCreated }: { orderId: string; onCreated: (review: NonNullable<Order["review"]>) => void }) {
  const t = useTranslations("orderDetail.review");
  const { authFetch } = useAuth();
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const comment = String(new FormData(event.currentTarget).get("comment") ?? "").trim();
    setBusy(true);
    try {
      const { review } = await authFetch<{ review: NonNullable<Order["review"]> }>(`orders/${orderId}/review`, { method: "POST", body: { rating, comment: comment || undefined } });
      onCreated(review);
      toast.success(t("thanks"));
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : t("title"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-3xl border border-brand-orange/40 bg-surface p-5">
      <h2 className="text-2xl">{t("title")}</h2>
      <p className="mt-1 text-sm text-foreground-secondary">{t("subtitle")}</p>
      <p className="mt-4 text-sm font-medium text-foreground">{t("rating")}</p>
      <div className="mt-1 flex gap-1" role="radiogroup" aria-label={t("rating")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={t("stars", { count: n })}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5"
          >
            <Star className={cn("size-8 transition-colors", n <= (hover || rating) ? "fill-brand-orange text-brand-orange" : "text-border")} />
          </button>
        ))}
      </div>
      <label className="mt-4 block text-sm font-medium text-foreground">
        {t("comment")}
        <textarea name="comment" rows={3} maxLength={1000} placeholder={t("commentPlaceholder")} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm outline-none focus:border-brand-blue" />
      </label>
      <button type="submit" disabled={busy} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-orange px-5 text-sm font-semibold text-white hover:bg-brand-orange-light disabled:opacity-60">
        {busy && <Loader2 className="size-4 animate-spin" />} {t("submit")}
      </button>
    </form>
  );
}

export function OrderDetail({ orderId, perspective = "buyer" }: { orderId: string; perspective?: "buyer" | "seller" | "admin" }) {
  const t = useTranslations("orderDetail");
  const to = useTranslations("orders");
  const ts = useTranslations("sellerArea.orders");
  const tc = useTranslations("checkout");
  const locale = useLocale();
  const { user, authFetch } = useAuth();
  const [order, setOrder] = useState<Order | null | "missing">(null);
  const [busy, setBusy] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    authFetch<{ order: Order }>(`orders/${orderId}`)
      .then(({ order }) => !cancelled && setOrder(order))
      .catch(() => !cancelled && setOrder("missing"));
    return () => {
      cancelled = true;
    };
  }, [orderId, authFetch]);

  if (order === null) return <div className="h-64 animate-pulse rounded-3xl bg-surface-hover" />;
  const backHref = perspective === "seller" ? "/seller/orders" : perspective === "admin" ? "/admin/orders" : "/account/orders";
  if (order === "missing") return <EmptyState title={to("notFound")} action={{ label: t("back"), href: backHref }} />;

  const isBuyer = order.buyerId === user?.id;
  const isSeller = !!user && order.advertisement?.store?.ownerId === user.id;
  const cod = order.paymentMethod === "CASH_ON_DELIVERY";
  const awaitingHandover = order.status === "PAID" || order.status === "CONFIRMED";
  const canConfirm = isBuyer && awaitingHandover && !order.buyerConfirmedAt;
  const canConfirmDelivery = isSeller && awaitingHandover && !order.sellerConfirmedAt;
  const canDispute = order.status === "PAID";
  const paymentInFlight = !!order.payment && (order.payment.status === "PENDING" || order.payment.status === "PROCESSING");
  const canCancel = ((isBuyer || isSeller) && order.status === "CONFIRMED" && !order.sellerConfirmedAt) || (isBuyer && order.status === "PENDING_PAYMENT" && !paymentInFlight);
  const canReview = isBuyer && order.status === "COMPLETED" && !order.review;
  const image = order.advertisement?.images?.[0];
  const store = order.advertisement?.store;

  const act = async (path: string, body?: unknown, success?: string) => {
    setBusy(true);
    try {
      const data = await authFetch<{ order?: Order; dispute?: unknown }>(path, { method: "POST", body });
      const fresh = await authFetch<{ order: Order }>(`orders/${orderId}`);
      setOrder(fresh.order);
      if (success) toast.success(success);
      return data;
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : to("notFound"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground-secondary hover:text-foreground">
        <ArrowLeft className="size-4" /> {t("back")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl">{t("title", { id: order.id.slice(-8).toUpperCase() })}</h1>
          <p className="mt-1 text-sm text-foreground-muted">{to("placedOn", { date: formatDate(order.createdAt, locale, { dateStyle: "long", timeStyle: "short" }) })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cod && <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 text-sm font-semibold text-success"><Banknote className="size-4" /> {to("paymentMethod.CASH_ON_DELIVERY")}</span>}
          <span className={cn("inline-flex rounded-full px-3 py-1 text-sm font-semibold", STATUS_STYLES[order.status])}>{to(`status.${order.status}`)}</span>
        </div>
      </div>
      <p className="rounded-2xl bg-brand-sky/40 p-4 text-sm text-foreground-secondary dark:bg-surface-elevated">
        {to(`statusHelp.${order.status}`)}
        {order.status === "CANCELLED" && order.cancelledBy && (
          <span className="mt-1 block text-xs text-foreground-muted">
            {to(`cancelledBy.${order.cancelledBy}`)}
            {order.cancelReason ? ` — ${order.cancelReason}` : ""}
          </span>
        )}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-border bg-surface p-5">
            <h2 className="mb-4 text-xl">{t("items")}</h2>
            <div className="flex gap-4">
              <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-surface-hover">
                {image && <Image src={image} alt="" fill sizes="96px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                {order.advertisement?.slug ? (
                  <Link href={`/products/${order.advertisement.slug}`} className="text-base font-semibold text-foreground hover:text-brand-blue">
                    {order.advertisement.title}
                  </Link>
                ) : (
                  <p className="text-base font-semibold text-foreground">{order.advertisement?.title}</p>
                )}
                <p className="mt-1 text-sm text-foreground-muted">{to("quantity", { count: order.quantity })}</p>
                {store && (
                  <p className="mt-1 text-sm text-foreground-secondary">
                    {t("seller")}{" "}
                    <Link href={`/stores/${store.slug}`} className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-brand-blue">
                      {store.name} <BadgeCheck className="size-4 text-brand-blue" />
                    </Link>
                  </p>
                )}
                <p className="mt-2 font-script text-2xl text-brand-blue dark:text-brand-blue-light">{formatPrice(order.totalAmount, locale)}</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-surface p-5">
            <h2 className="mb-4 text-xl">{t("timeline.title")}</h2>
            <ol className="relative space-y-4 border-l border-border pl-6">
              {timeline(order).map((step) => (
                <li key={step.key} className="relative">
                  <span className={cn("absolute -left-[31px] top-0.5 inline-flex size-5 items-center justify-center rounded-full bg-surface", step.done ? "text-success" : "text-border")}>
                    {step.done ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
                  </span>
                  <p className={cn("text-sm", step.done ? "font-semibold text-foreground" : "text-foreground-muted")}>{t(`timeline.${step.key}`)}</p>
                  {step.date && <p className="text-xs text-foreground-muted">{formatDate(step.date, locale, { dateStyle: "medium", timeStyle: "short" })}</p>}
                </li>
              ))}
            </ol>
          </section>

          {(order.deliveryAddress || order.deliveryPhone) && (
            <section className="rounded-3xl border border-border bg-surface p-5">
              <h2 className="text-xl">{t("delivery.title")}</h2>
              <dl className="mt-3 space-y-2 text-sm">
                {order.deliveryAddress && (
                  <div className="flex gap-3">
                    <dt className="inline-flex shrink-0 items-center gap-1.5 text-foreground-muted"><MapPin className="size-4" /> {t("delivery.address")}</dt>
                    <dd className="whitespace-pre-line text-foreground">{order.deliveryAddress}</dd>
                  </div>
                )}
                {order.deliveryPhone && (
                  <div className="flex gap-3">
                    <dt className="inline-flex shrink-0 items-center gap-1.5 text-foreground-muted"><Phone className="size-4" /> {t("delivery.phone")}</dt>
                    <dd><a href={`tel:${order.deliveryPhone}`} className="font-medium text-brand-blue hover:underline">{order.deliveryPhone}</a></dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {isSeller && order.buyer && (
            <section className="rounded-3xl border border-border bg-surface p-5">
              <h2 className="text-xl">{ts("buyer")}</h2>
              <p className="mt-2 text-base font-semibold text-foreground">
                {order.buyer.firstName} {order.buyer.lastName}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {order.buyer.phone && (
                  <a href={`tel:${order.buyer.phone}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3.5 text-sm font-semibold text-foreground hover:border-brand-blue hover:text-brand-blue">
                    <Phone className="size-4" /> {ts("call")} · {order.buyer.phone}
                  </a>
                )}
                {order.buyer.email && (
                  <a href={`mailto:${order.buyer.email}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3.5 text-sm font-semibold text-foreground hover:border-brand-blue hover:text-brand-blue">
                    <Mail className="size-4" /> {ts("email")}
                  </a>
                )}
              </div>
            </section>
          )}

          {(canConfirm || canConfirmDelivery || canDispute || canCancel || (isBuyer && order.status === "PENDING_PAYMENT")) && (
            <section className="space-y-3 rounded-3xl border border-border bg-surface p-5">
              <div className="flex flex-wrap gap-2">
                {isBuyer && order.status === "PENDING_PAYMENT" && order.advertisement?.slug && (
                  <Link href={`/checkout/${order.advertisement.slug}?qty=${order.quantity}&order=${order.id}`} className="inline-flex h-11 items-center rounded-xl bg-brand-orange px-4 text-sm font-semibold text-white hover:bg-brand-orange-light">
                    {to("payNow")}
                  </Link>
                )}
                {canConfirmDelivery && (
                  <button type="button" disabled={busy} onClick={() => act(`orders/${orderId}/confirm-delivery`, undefined, ts("delivered"))} className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white hover:bg-brand-blue-light disabled:opacity-60">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />} {cod ? ts("confirmDeliveryCod") : ts("confirmDelivery")}
                  </button>
                )}
                {canCancel && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (!window.confirm(to("cancelConfirm"))) return;
                      await act(`orders/${orderId}/cancel`, {}, to("cancelled"));
                    }}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-danger/40 px-4 text-sm font-semibold text-danger hover:bg-danger/10 disabled:opacity-60"
                  >
                    <XCircle className="size-4" /> {to("cancel")}
                  </button>
                )}
                {canConfirm && (
                  <button type="button" disabled={busy} onClick={() => act(`orders/${orderId}/confirm-receipt`, undefined, to("confirmed"))} className="inline-flex h-11 items-center gap-2 rounded-xl bg-success px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} {to("confirmReceipt")}
                  </button>
                )}
                {canDispute && !disputeOpen && (
                  <button type="button" onClick={() => setDisputeOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-danger/40 px-4 text-sm font-semibold text-danger hover:bg-danger/10">
                    <AlertTriangle className="size-4" /> {to("openDispute")}
                  </button>
                )}
              </div>
              {canConfirm && <p className="text-xs text-foreground-muted">{cod ? to("confirmReceiptHelpCod") : to("confirmReceiptHelp")}</p>}
              {canConfirmDelivery && <p className="text-xs text-foreground-muted">{cod ? ts("codHelp") : ts("confirmDeliveryHelp")}</p>}
              {isSeller && awaitingHandover && order.sellerConfirmedAt && <p className="text-xs text-foreground-muted">{ts("awaitingBuyer")}</p>}
              {disputeOpen && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await act(`orders/${orderId}/dispute`, { reason }, to("disputeOpened"));
                    setDisputeOpen(false);
                  }}
                  className="space-y-3 rounded-xl border border-danger/30 bg-danger/5 p-4"
                >
                  <label className="block text-sm font-medium text-foreground">
                    {to("disputeReason")}
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} required minLength={10} rows={4} placeholder={to("disputePlaceholder")} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm outline-none focus:border-brand-blue" />
                  </label>
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy || reason.trim().length < 10} className="inline-flex h-10 items-center rounded-xl bg-danger px-3.5 text-sm font-semibold text-white disabled:opacity-60">
                      {to("disputeSubmit")}
                    </button>
                    <button type="button" onClick={() => setDisputeOpen(false)} className="inline-flex h-10 items-center rounded-xl border border-border px-3.5 text-sm font-medium text-foreground-secondary">
                      ✕
                    </button>
                  </div>
                </form>
              )}
            </section>
          )}

          {order.disputes && order.disputes.length > 0 && (
            <section className="rounded-3xl border border-danger/30 bg-surface p-5">
              <h2 className="mb-3 text-xl">{t("timeline.disputed")}</h2>
              <ul className="space-y-3">
                {order.disputes.map((d) => (
                  <li key={d.id} className="rounded-xl bg-danger/5 p-3 text-sm">
                    <p className="text-foreground">{d.reason}</p>
                    <p className="mt-1 text-xs text-foreground-muted">
                      {d.status} · {formatDate(d.createdAt, locale)}
                      {d.resolution ? ` — ${d.resolution}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

              {order.refund && (
            <section className="rounded-3xl border border-border bg-surface p-5">
              <h2 className="text-xl">{t("refund.title")}</h2>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", order.refund.status === "COMPLETED" ? "bg-success/15 text-success" : order.refund.status === "FAILED" || order.refund.status === "CANCELLED" ? "bg-warning/15 text-warning" : "bg-brand-blue/10 text-brand-blue dark:text-brand-blue-light")}>
                  {t(`refund.statuses.${order.refund.status}`)}
                </span>
                <span className="font-script text-lg text-brand-blue dark:text-brand-blue-light">{formatPrice(order.refund.amount, locale)}</span>
              </p>
              <p className="mt-2 text-sm text-foreground-secondary">
                {order.refund.status === "COMPLETED"
                  ? `${t("refund.sentTo", { phone: order.refund.phoneNumber })}${order.refund.completedAt ? ` · ${t("refund.completedAt", { date: formatDate(order.refund.completedAt, locale, { dateStyle: "medium", timeStyle: "short" }) })}` : ""}`
                  : order.refund.status === "FAILED" || order.refund.status === "CANCELLED"
                    ? t("refund.delayed")
                    : t("refund.pending", { phone: order.refund.phoneNumber })}
              </p>
            </section>
          )}
          {canReview && <ReviewForm orderId={orderId} onCreated={(review) => setOrder({ ...order, review })} />}
          {order.review && (
                    <section className="rounded-3xl border border-border bg-surface p-5">
              <h2 className="text-xl">{t("review.yours")}</h2>
              <div className="mt-2 flex gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={cn("size-5", n <= order.review!.rating ? "fill-brand-orange text-brand-orange" : "text-border")} />
                ))}
              </div>
              {order.review.comment && <p className="mt-2 text-sm text-foreground-secondary">{order.review.comment}</p>}
            </section>
          )}
        </div>

        <aside className="h-fit rounded-3xl border border-border bg-surface p-5">
          <h2 className="text-xl">{t("payment.title")}</h2>
          {cod ? (
            <div className="mt-3 space-y-3 text-sm">
              <p className="inline-flex items-center gap-2 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success"><Banknote className="size-4" /> {t("payment.cod")}</p>
              <p className="text-foreground-secondary">{t("payment.codHelp", { amount: formatPrice(order.totalAmount, locale) })}</p>
              <p className="text-xs text-foreground-muted">{to("cod.noEscrow")}</p>
              <div className="flex justify-between gap-3 border-t border-border pt-2">
                <span className="text-foreground-muted">{to("total")}</span>
                <span className="font-script text-xl text-brand-blue dark:text-brand-blue-light">{formatPrice(order.totalAmount, locale)}</span>
              </div>
            </div>
          ) : order.payment ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-foreground-muted">{t("payment.provider")}</dt>
                <dd className="font-medium text-foreground">{order.payment.provider && tc.has(order.payment.provider) ? tc(order.payment.provider) : order.payment.provider ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-foreground-muted">{t("payment.status")}</dt>
                <dd className="font-medium text-foreground">{order.payment.status}</dd>
              </div>
              {order.payment.providerReference && (
                <div className="flex justify-between gap-3">
                  <dt className="text-foreground-muted">{t("payment.reference")}</dt>
                  <dd className="truncate font-mono text-xs text-foreground">{order.payment.providerReference}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3 border-t border-border pt-2">
                <dt className="text-foreground-muted">{to("total")}</dt>
                <dd className="font-script text-xl text-brand-blue dark:text-brand-blue-light">{formatPrice(order.totalAmount, locale)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-foreground-secondary">{t("payment.none")}</p>
          )}
        </aside>
      </div>
    </div>
  );
}
