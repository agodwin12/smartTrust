"use client";

import { Eye } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useAdminList } from "@/features/admin/useAdminList";
import { Link } from "@/i18n/navigation";
import { formatDate, formatPrice } from "@/lib/format";
import type { Dispute, DisputeStatus } from "@/types";
import { AdminHeader, AdminTable, ClientPagination, FilterSelect, IdChip, StatusPill, Toolbar, rowAction, type Column } from "./primitives";

const STATUSES: DisputeStatus[] = ["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"];

export function DisputesView() {
  const t = useTranslations("admin.disputes");
  const tc = useTranslations("admin.common");
  const to = useTranslations("orders");
  const locale = useLocale();
  const [status, setStatus] = useState<DisputeStatus | "">("");
  const list = useAdminList<Dispute>("disputes", { status: status || undefined });

  const columns: Column<Dispute>[] = [
    {
      key: "dispute",
      header: t("title"),
      primary: true,
      cell: (d) => (
        <div className="min-w-0">
          <Link href={`/admin/disputes/${d.id}`} className="block truncate font-semibold text-foreground hover:text-brand-blue">
            {d.order.advertisement?.title ?? <IdChip id={d.orderId} />}
          </Link>
          <p className="truncate text-xs text-foreground-muted" title={d.reason}>
            {d.reason}
          </p>
        </div>
      ),
    },
    {
      key: "raisedBy",
      header: t("raisedBy"),
      cell: (d) => (
        <span className="text-foreground">
          {d.raisedBy.firstName} {d.raisedBy.lastName}
        </span>
      ),
    },
    {
      key: "store",
      header: tc("store"),
      cell: (d) =>
        d.order.advertisement?.store?.slug ? (
          <Link href={`/stores/${d.order.advertisement.store.slug}`} className="text-brand-blue hover:underline">
            {d.order.advertisement.store.name}
          </Link>
        ) : (
          "—"
        ),
    },
    { key: "status", header: tc("status"), cell: (d) => <StatusPill status={d.status} label={t(`statuses.${d.status}`)} /> },
    { key: "order", header: t("viewOrder"), cell: (d) => <StatusPill status={d.order.status} label={to(`status.${d.order.status}`)} /> },
    { key: "amount", header: tc("amount"), className: "whitespace-nowrap", cell: (d) => <span className="font-script text-lg text-brand-blue dark:text-brand-blue-light">{formatPrice(d.order.totalAmount, locale)}</span> },
    { key: "date", header: tc("date"), className: "whitespace-nowrap text-foreground-secondary", cell: (d) => formatDate(d.createdAt, locale) },
    {
      key: "actions",
      header: <span className="sr-only">{tc("actions")}</span>,
      className: "text-right",
      cell: (d) => (
        <Link href={`/admin/disputes/${d.id}`} className={rowAction}>
          <Eye className="size-3.5" /> {tc("view")}
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader title={t("title")} subtitle={t("subtitle")} />
      <Toolbar>
        <FilterSelect<DisputeStatus> ariaLabel={tc("status")} value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) }))} />
      </Toolbar>
      <AdminTable columns={columns} rows={list.items} rowKey={(d) => d.id} loading={list.loading} error={list.error} empty={tc("none")} footer={<ClientPagination page={list.page} pageSize={list.pageSize} total={list.total} onChange={list.setPage} />} />
    </div>
  );
}
