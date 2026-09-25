"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useAdminList } from "@/features/admin/useAdminList";
import { Link } from "@/i18n/navigation";
import { formatDate, formatPrice } from "@/lib/format";
import type { AdminPayment, PaymentStatus } from "@/types";
import { cn } from "@/lib/utils";
import { canFinance } from "@/features/admin/roles";
import { useAuth } from "@/features/auth/AuthProvider";
import { RefundsView } from "./RefundsView";
import { AdminHeader, AdminTable, ClientPagination, FilterSelect, IdChip, StatusPill, Toolbar, type Column } from "./primitives";

const STATUSES: PaymentStatus[] = ["PENDING", "COMPLETED", "FAILED", "CANCELLED"];

type PaymentRow = AdminPayment & { phoneNumber?: string | null; failureReason?: string | null; currency?: string };

export function PaymentsView() {
  const t = useTranslations("admin.payments");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const { user } = useAuth();
  const [tab, setTab] = useState<"payments" | "refunds">("payments");
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const list = useAdminList<PaymentRow>("payments", { status: status || undefined });

  const columns: Column<PaymentRow>[] = [
    {
      key: "what",
      header: t("kind.order"),
      primary: true,
      cell: (p) => (
        <div className="min-w-0">
          {p.order ? (
            <Link href={`/admin/orders/${p.order.id}`} className="block truncate font-semibold text-foreground hover:text-brand-blue">
              {t("kind.order")} · {p.order.advertisement?.title ?? <IdChip id={p.order.id} />}
            </Link>
          ) : p.group ? (
            <p className="truncate font-semibold text-foreground">
              {t("kind.group")} · {p.group.reference} · {t("groupItems", { count: p.group.itemCount })}
            </p>
          ) : p.subscription ? (
            <p className="truncate font-semibold text-foreground">
              {t("kind.subscription")} · {p.subscription.plan?.name}
            </p>
          ) : (
            <IdChip id={p.id} />
          )}
          <p className="truncate text-xs text-foreground-muted">
            {p.order?.buyer?.email ?? p.group?.buyer?.email ?? p.subscription?.store?.name ?? ""}
            {p.phoneNumber && ` · ${p.phoneNumber}`}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: tc("status"),
      cell: (p) => (
        <div className="space-y-1">
          <StatusPill status={p.status} label={t(`statuses.${p.status}`)} />
          {p.failureReason && <p className="max-w-[220px] truncate text-xs text-danger" title={p.failureReason}>{p.failureReason}</p>}
        </div>
      ),
    },
    {
      key: "reference",
      header: t("reference"),
      className: "text-foreground-secondary",
      cell: (p) => <span className="font-mono text-xs">{p.providerReference ?? p.externalId ?? "—"}</span>,
    },
    { key: "amount", header: tc("amount"), className: "whitespace-nowrap", cell: (p) => <span className="font-bold text-lg text-brand-blue dark:text-brand-blue-light">{formatPrice(p.amount, locale)}</span> },
    { key: "date", header: tc("date"), className: "whitespace-nowrap text-foreground-secondary", cell: (p) => formatDate(p.createdAt, locale, { dateStyle: "medium", timeStyle: "short" }) },
  ];

  const tabs = (["payments", "refunds"] as const).filter((key) => key === "payments" || canFinance(user));

  return (
    <div className="space-y-6">
      <AdminHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="flex gap-2">
        {tabs.map((key) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={cn("inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors", tab === key ? "border-brand-blue bg-brand-blue text-white" : "border-border bg-surface text-foreground-secondary hover:border-brand-blue hover:text-brand-blue")}>
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>
      {tab === "refunds" ? (
        <RefundsView />
      ) : (
        <>
          <Toolbar>
            <FilterSelect<PaymentStatus> ariaLabel={tc("status")} value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) }))} />
          </Toolbar>
          <AdminTable columns={columns} rows={list.items} rowKey={(p) => p.id} loading={list.loading} error={list.error} empty={tc("none")} footer={<ClientPagination page={list.page} pageSize={list.pageSize} total={list.total} onChange={list.setPage} />} />
        </>
      )}
    </div>
  );
}
