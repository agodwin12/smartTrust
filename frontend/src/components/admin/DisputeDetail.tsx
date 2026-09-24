"use client";

import { ArrowLeft, Banknote, Loader2, Lock, Mail, Phone, RotateCcw, Search, ShieldCheck, XCircle } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { canFinance, canOperate } from "@/features/admin/roles";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Dispute, Refund } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";
import { EmptyState } from "@/components/ui/EmptyState";
import { RefundRetrySheet, RefundSummary } from "./RefundsView";
import { IdChip, StatusPill, adminDanger, adminField, adminSecondary, adminSuccess } from "./primitives";

export function DisputeDetail({ disputeId }: { disputeId: string }) {
  const t = useTranslations("admin.disputes");
  const tc = useTranslations("admin.common");
  const to = useTranslations("orders");
  const tor = useTranslations("admin.orders");
  const locale = useLocale();
  const { user: me, authFetch } = useAuth();
  const describeError = useAuthError();
  const [dispute, setDispute] = useState<Dispute | null | "missing">(null);
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<Refund | null>(null);

  const load = useCallback(
    () =>
      authFetch<{ dispute: Dispute }>(`disputes/${disputeId}`)
        .then(({ dispute }) => {
          setDispute(dispute);
          setResolution((current) => current || dispute.resolution || "");
        })
        .catch(() => setDispute("missing")),
    [authFetch, disputeId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (dispute === null) return <div className="h-72 animate-pulse rounded-3xl bg-surface-hover" />;
  if (dispute === "missing") return <EmptyState title={tc("none")} action={{ label: t("title"), href: "/admin/disputes" }} />;

  const open = dispute.status === "OPEN" || dispute.status === "IN_REVIEW";
  const escrowHeld = dispute.order.escrow?.status === "HELD";
  const operate = canOperate(me);
  const finance = canFinance(me);
  const order = dispute.order;
  const store = order.advertisement?.store;

  const run = async (key: string, path: string, method: "PATCH" | "POST", body: unknown, success: string, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(key);
    try {
      await authFetch(path, { method, body });
      toast.success(success);
      await load();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  const refreshRefund = async (refund: Refund) => {
    setBusy("refund");
    try {
      await authFetch(`refunds/${refund.id}/refresh`);
      await load();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  const note = resolution.trim() || undefined;
  const update = (status: Dispute["status"], success: string) => run(status, `disputes/${dispute.id}`, "PATCH", { status, ...(note && { resolution: note }) }, success);

  return (
    <div className="space-y-6">
      <Link href="/admin/disputes" className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground-secondary hover:text-brand-blue">
        <ArrowLeft className="size-4" /> {t("title")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl">{t("detail")}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-foreground-secondary">
            <IdChip id={dispute.id} /> · {formatDate(dispute.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <StatusPill status={dispute.status} label={t(`statuses.${dispute.status}`)} className="text-sm" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/* Order */}
          <section className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-start gap-4">
              <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-surface-hover">{order.advertisement?.images?.[0] && <Image src={order.advertisement.images[0]} alt="" fill sizes="80px" className="object-cover" />}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold text-foreground">{order.advertisement?.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
                  <IdChip id={order.id} /> <StatusPill status={order.status} label={to(`status.${order.status}`)} />
                  {order.escrow && <StatusPill status={order.escrow.status} label={`${tor("escrow")}: ${tor(`escrowStatus.${order.escrow.status}`)}`} />}
                </p>
                <p className="mt-2 font-script text-2xl text-brand-blue dark:text-brand-blue-light">{formatPrice(order.totalAmount, locale)}</p>
              </div>
            </div>
            <Link href={`/admin/orders/${order.id}`} className={cn(adminSecondary, "mt-4 w-full sm:w-auto")}>
              {t("viewOrder")}
            </Link>
          </section>

          {/* Reason */}
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-lg">{t("reason")}</h2>
            <p className="mt-1 text-xs text-foreground-muted">
              {t("raisedBy")}: {dispute.raisedBy.firstName} {dispute.raisedBy.lastName}
              {dispute.raisedBy.email && ` · ${dispute.raisedBy.email}`}
            </p>
            <p className="mt-3 whitespace-pre-line text-sm text-foreground">{dispute.reason}</p>
            {dispute.resolution && !open && (
              <div className="mt-4 rounded-xl bg-surface-hover p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{t("resolution")}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-foreground">{dispute.resolution}</p>
                {dispute.resolvedAt && <p className="mt-2 text-xs text-foreground-muted">{formatDate(dispute.resolvedAt, locale, { dateStyle: "medium", timeStyle: "short" })}</p>}
              </div>
            )}
          </section>

          {/* Buyer refund (after a refund resolution) */}
          {order.refund && (
            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-lg">{t("refund.title")}</h2>
              <div className="mt-3">
                <RefundSummary refund={order.refund} busy={busy === "refund"} onRetry={finance ? () => setRetrying(order.refund ?? null) : undefined} onRefresh={finance ? () => refreshRefund(order.refund as Refund) : undefined} />
              </div>
            </section>
          )}

          {/* Decision */}
          {open && (
            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-lg">{t("resolution")}</h2>
              <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={4} placeholder={t("resolutionPlaceholder")} disabled={!operate && !finance} className={cn(adminField, "mt-3 h-auto w-full py-2")} />
              <div className="mt-4 flex flex-wrap gap-2">
                {operate && dispute.status === "OPEN" && (
                  <button type="button" disabled={!!busy} onClick={() => update("IN_REVIEW", t("updated"))} className={adminSecondary}>
                    {busy === "IN_REVIEW" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} {t("markInReview")}
                  </button>
                )}
                {operate && (
                  <button type="button" disabled={!!busy} onClick={() => update("REJECTED", t("updated"))} className={adminSecondary}>
                    {busy === "REJECTED" ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} {t("reject")}
                  </button>
                )}
                {finance ? (
                  <>
                    <button type="button" disabled={!!busy || !escrowHeld} onClick={() => run("release", `disputes/${dispute.id}/release-to-seller`, "POST", { resolution: note }, t("released"), t("confirmRelease"))} className={adminSuccess}>
                      {busy === "release" ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />} {t("releaseToSeller")}
                    </button>
                    <button type="button" disabled={!!busy || !escrowHeld} onClick={() => run("refund", `disputes/${dispute.id}/refund-buyer`, "POST", { resolution: note }, t("refunded"), t("confirmRefund"))} className={adminDanger}>
                      {busy === "refund" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} {t("refundBuyer")}
                    </button>
                  </>
                ) : (
                  <p className="inline-flex items-center gap-2 rounded-xl bg-surface-hover px-3 py-2 text-xs text-foreground-secondary">
                    <Lock className="size-3.5" /> {t("escrowOnly")}
                  </p>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Parties */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-lg">{t("parties")}</h2>
            <dl className="mt-3 space-y-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{tc("buyer")}</dt>
                <dd className="mt-1 text-foreground">
                  {order.buyer ? `${order.buyer.firstName} ${order.buyer.lastName}` : "—"}
                  <div className="mt-1 flex flex-col gap-1 text-xs">
                    {order.buyer?.email && (
                      <a href={`mailto:${order.buyer.email}`} className="inline-flex items-center gap-1.5 text-brand-blue hover:underline">
                        <Mail className="size-3.5" /> {order.buyer.email}
                      </a>
                    )}
                    {order.buyer?.phone && (
                      <a href={`tel:${order.buyer.phone}`} className="inline-flex items-center gap-1.5 text-brand-blue hover:underline">
                        <Phone className="size-3.5" /> {order.buyer.phone}
                      </a>
                    )}
                  </div>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{tc("seller")}</dt>
                <dd className="mt-1 text-foreground">
                  {store ? (
                    <Link href={`/stores/${store.slug}`} className="font-medium hover:text-brand-blue">
                      {store.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                  {store?.contactPhone && (
                    <a href={`tel:${store.contactPhone}`} className="mt-1 flex items-center gap-1.5 text-xs text-brand-blue hover:underline">
                      <Phone className="size-3.5" /> {store.contactPhone}
                    </a>
                  )}
                </dd>
              </div>
              {order.payment && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{tor("escrow")}</dt>
                  <dd className="mt-1 flex flex-wrap items-center gap-2">
                    <ShieldCheck className="size-4 text-success" />
                    <span className="text-foreground">{order.escrow ? formatPrice(order.escrow.amount, locale) : formatPrice(order.totalAmount, locale)}</span>
                    {order.payment.provider && <span className="text-xs text-foreground-muted">{order.payment.provider}</span>}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </aside>
      </div>
      <RefundRetrySheet refund={retrying} onClose={() => setRetrying(null)} onDone={() => void load()} />
    </div>
  );
}
