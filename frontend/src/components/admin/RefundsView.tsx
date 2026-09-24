"use client";

import { Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAdminList } from "@/features/admin/useAdminList";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Refund, RefundStatus } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";
import { PROVIDERS } from "@/components/seller/MobileMoneyPayment";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AdminTable, ClientPagination, Field, FilterSelect, IdChip, StatusPill, Toolbar, adminField, adminPrimary, rowAction, type Column } from "./primitives";

const STATUSES: RefundStatus[] = ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"];

/** Correct the destination and re-issue a failed payout. */
export function RefundRetrySheet({ refund, onClose, onDone }: { refund: Refund | null; onClose: () => void; onDone: (refund: Refund) => void }) {
  const t = useTranslations("admin.refunds");
  const tk = useTranslations("checkout");
  const { authFetch } = useAuth();
  const describeError = useAuthError();
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!refund) return;
    const form = new FormData(event.currentTarget);
    const operator = String(form.get("operator") ?? "");
    const phoneNumber = String(form.get("phoneNumber") ?? "").trim();
    setBusy(true);
    try {
      const { refund: updated } = await authFetch<{ refund: Refund }>(`refunds/${refund.id}/retry`, {
        method: "POST",
        body: { ...(operator && { operator }), ...(phoneNumber && phoneNumber !== refund.phoneNumber && { phoneNumber }) },
      });
      toast[updated.status === "FAILED" ? "error" : "success"](updated.status === "FAILED" ? updated.failureReason ?? t("statuses.FAILED") : t("retried"));
      onDone(updated);
      onClose();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!refund} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("retryTitle")}</SheetTitle>
          <SheetDescription>{t("retryHint")}</SheetDescription>
        </SheetHeader>
        {refund && (
          <form key={refund.id} onSubmit={submit} className="space-y-4 px-4 pb-6">
            {refund.failureReason && (
              <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
                {t("reason")}: {refund.failureReason}
              </p>
            )}
            <Field label={t("operator")}>
              <select name="operator" defaultValue={refund.operator ?? ""} className={cn(adminField, "w-full")}>
                <option value="">—</option>
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {tk(p)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("phone")}>
              <input name="phoneNumber" type="tel" defaultValue={refund.phoneNumber} className={cn(adminField, "w-full")} />
            </Field>
            <button type="submit" disabled={busy} className={cn(adminPrimary, "w-full")}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} {t("retry")}
            </button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Compact status + destination + reason block, reused by the dispute page. */
export function RefundSummary({ refund, onRetry, onRefresh, busy }: { refund: Refund; onRetry?: () => void; onRefresh?: () => void; busy?: boolean }) {
  const t = useTranslations("admin.refunds");
  const locale = useLocale();
  const retryable = refund.status === "FAILED" || refund.status === "CANCELLED";
  const inFlight = refund.status === "PENDING" || refund.status === "PROCESSING";
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={refund.status} label={t(`statuses.${refund.status}`)} />
        <span className="font-script text-lg text-brand-blue dark:text-brand-blue-light">{formatPrice(refund.amount, locale)}</span>
        <span className="text-xs text-foreground-muted">{t("attempts", { count: refund.attempts })}</span>
      </div>
      <p className="text-foreground-secondary">
        {t("destination")}: <span className="font-mono text-xs text-foreground">{refund.phoneNumber || "—"}</span>
        {refund.operator && <span className="ml-1 text-xs text-foreground-muted">({refund.operator})</span>}
        {refund.providerReference && <span className="ml-2 font-mono text-xs text-foreground-muted">{refund.providerReference}</span>}
      </p>
      {refund.failureReason && <p className="text-xs text-danger">{refund.failureReason}</p>}
      {refund.completedAt && <p className="text-xs text-foreground-muted">{formatDate(refund.completedAt, locale, { dateStyle: "medium", timeStyle: "short" })}</p>}
      {(onRetry || onRefresh) && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {retryable && onRetry && (
            <button type="button" disabled={busy} onClick={onRetry} className={cn(rowAction, "border-brand-orange/40 text-brand-orange hover:border-brand-orange")}>
              <RotateCcw className="size-3.5" /> {t("retry")}
            </button>
          )}
          {inFlight && onRefresh && (
            <button type="button" disabled={busy} onClick={onRefresh} className={rowAction}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} {t("refresh")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function RefundsView() {
  const t = useTranslations("admin.refunds");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const { authFetch } = useAuth();
  const describeError = useAuthError();
  const [status, setStatus] = useState<RefundStatus | "">("");
  const [retrying, setRetrying] = useState<Refund | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const list = useAdminList<Refund>("refunds", { status: status || undefined });

  const refresh = async (refund: Refund) => {
    setBusyId(refund.id);
    try {
      await authFetch(`refunds/${refund.id}/refresh`);
      toast.success(t("refreshed"));
      list.reload();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusyId(null);
    }
  };

  const columns: Column<Refund>[] = [
    {
      key: "order",
      header: tc("buyer"),
      primary: true,
      cell: (r) => (
        <div className="min-w-0">
          {r.order ? (
            <Link href={`/admin/orders/${r.order.id}`} className="block truncate font-semibold text-foreground hover:text-brand-blue">
              {r.order.advertisement?.title ?? <IdChip id={r.order.id} />}
            </Link>
          ) : (
            <IdChip id={r.orderId} />
          )}
          <p className="truncate text-xs text-foreground-muted">
            {r.order?.buyer ? `${r.order.buyer.firstName} ${r.order.buyer.lastName}` : ""}
            {r.order?.buyer?.email && ` · ${r.order.buyer.email}`}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: tc("status"),
      cell: (r) => (
        <div className="space-y-1">
          <StatusPill status={r.status} label={t(`statuses.${r.status}`)} />
          {r.failureReason && (
            <p className="max-w-[240px] truncate text-xs text-danger" title={r.failureReason}>
              {r.failureReason}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "destination",
      header: t("destination"),
      cell: (r) => (
        <div>
          <p className="font-mono text-xs text-foreground">{r.phoneNumber || "—"}</p>
          <p className="text-xs text-foreground-muted">{r.operator ?? "—"}</p>
        </div>
      ),
    },
    { key: "attempts", header: t("attempts", { count: 2 }).replace(/^\d+\s*/, ""), className: "text-foreground-secondary", cell: (r) => r.attempts },
    { key: "amount", header: tc("amount"), className: "whitespace-nowrap", cell: (r) => <span className="font-script text-lg text-brand-blue dark:text-brand-blue-light">{formatPrice(r.amount, locale)}</span> },
    { key: "date", header: tc("date"), className: "whitespace-nowrap text-foreground-secondary", cell: (r) => formatDate(r.createdAt, locale, { dateStyle: "medium", timeStyle: "short" }) },
    {
      key: "actions",
      header: <span className="sr-only">{tc("actions")}</span>,
      className: "text-right",
      cell: (r) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          {(r.status === "FAILED" || r.status === "CANCELLED") && (
            <button type="button" onClick={() => setRetrying(r)} className={cn(rowAction, "border-brand-orange/40 text-brand-orange hover:border-brand-orange")}>
              <RotateCcw className="size-3.5" /> {t("retry")}
            </button>
          )}
          {(r.status === "PENDING" || r.status === "PROCESSING") && (
            <button type="button" disabled={busyId === r.id} onClick={() => refresh(r)} className={rowAction}>
              {busyId === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} {t("refresh")}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground-secondary">{t("subtitle")}</p>
      <Toolbar>
        <FilterSelect<RefundStatus> ariaLabel={tc("status")} value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) }))} />
      </Toolbar>
      <AdminTable columns={columns} rows={list.items} rowKey={(r) => r.id} loading={list.loading} error={list.error} empty={tc("none")} footer={<ClientPagination page={list.page} pageSize={list.pageSize} total={list.total} onChange={list.setPage} />} />
      <RefundRetrySheet refund={retrying} onClose={() => setRetrying(null)} onDone={() => list.reload()} />
    </div>
  );
}
