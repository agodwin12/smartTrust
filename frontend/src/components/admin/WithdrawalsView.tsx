"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useAdminList } from "@/features/admin/useAdminList";
import { Link } from "@/i18n/navigation";
import { formatDate, formatPrice } from "@/lib/format";
import type { AdminWithdrawal, WithdrawalStatus } from "@/types";
import { AdminHeader, AdminTable, ClientPagination, FilterSelect, IdChip, StatusPill, Toolbar, type Column } from "./primitives";

const STATUSES: WithdrawalStatus[] = ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"];

export function WithdrawalsView() {
  const t = useTranslations("admin.withdrawals");
  const tc = useTranslations("admin.common");
  const tw = useTranslations("sellerArea.wallet");
  const locale = useLocale();
  const [status, setStatus] = useState<WithdrawalStatus | "">("");
  const list = useAdminList<AdminWithdrawal>("withdrawals", { status: status || undefined });

  const columns: Column<AdminWithdrawal>[] = [
    {
      key: "store",
      header: tc("store"),
      primary: true,
      cell: (w) => (
        <div className="min-w-0">
          {w.store ? (
            <Link href={`/stores/${w.store.slug}`} className="block truncate font-semibold text-foreground hover:text-brand-blue">
              {w.store.name}
            </Link>
          ) : (
            <IdChip id={w.id} />
          )}
          <p className="text-xs text-foreground-muted">
            <IdChip id={w.id} />
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: tc("status"),
      cell: (w) => (
        <div className="space-y-1">
          <StatusPill status={w.status} label={tw.has(`status.${w.status}`) ? tw(`status.${w.status}`) : w.status} />
          {w.failureReason && <p className="max-w-[220px] truncate text-xs text-danger" title={w.failureReason}>{w.failureReason}</p>}
        </div>
      ),
    },
    { key: "provider", header: t("provider"), className: "text-foreground-secondary", cell: (w) => w.provider ?? "—" },
    { key: "phone", header: t("phone"), className: "font-mono text-xs text-foreground-secondary", cell: (w) => w.phoneNumber },
    { key: "amount", header: tc("amount"), className: "whitespace-nowrap", cell: (w) => <span className="font-bold text-lg text-brand-blue dark:text-brand-blue-light">{formatPrice(w.amount, locale)}</span> },
    { key: "date", header: tc("date"), className: "whitespace-nowrap text-foreground-secondary", cell: (w) => formatDate(w.createdAt, locale, { dateStyle: "medium", timeStyle: "short" }) },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader title={t("title")} subtitle={t("subtitle")} />
      <Toolbar>
        <FilterSelect<WithdrawalStatus> ariaLabel={tc("status")} value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: tw.has(`status.${s}`) ? tw(`status.${s}`) : s }))} />
      </Toolbar>
      <AdminTable columns={columns} rows={list.items} rowKey={(w) => w.id} loading={list.loading} error={list.error} empty={tc("none")} footer={<ClientPagination page={list.page} pageSize={list.pageSize} total={list.total} onChange={list.setPage} />} />
    </div>
  );
}
