"use client";

import { Eye } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAdminList } from "@/features/admin/useAdminList";
import { Link } from "@/i18n/navigation";
import { formatDate, formatPrice } from "@/lib/format";
import type { Order, OrderStatus } from "@/types";
import { AdminHeader, AdminTable, ClientPagination, FilterSelect, IdChip, StatusPill, Toolbar, rowAction, type Column } from "./primitives";

const STATUSES: OrderStatus[] = ["PENDING_PAYMENT", "CONFIRMED", "PAID", "DISPUTED", "COMPLETED", "REFUNDED", "CANCELLED"];

const isOrderStatus = (value: string | null): value is OrderStatus => !!value && (STATUSES as string[]).includes(value);

export function AdminOrdersView() {
  const t = useTranslations("admin.orders");
  const tc = useTranslations("admin.common");
  const to = useTranslations("orders");
  const locale = useLocale();
  const search = useSearchParams();
  const initial = search.get("status");
  const [status, setStatus] = useState<OrderStatus | "">(isOrderStatus(initial) ? initial : "");
  const list = useAdminList<Order>("orders", { status: status || undefined });

  const columns: Column<Order>[] = [
    {
      key: "order",
      header: t("title"),
      primary: true,
      cell: (o) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-surface-hover">{o.advertisement?.images?.[0] && <Image src={o.advertisement.images[0]} alt="" fill sizes="48px" className="object-cover" />}</span>
          <div className="min-w-0">
            <Link href={`/admin/orders/${o.id}`} className="block truncate font-semibold text-foreground hover:text-brand-blue">
              {o.advertisement?.title}
            </Link>
            <p className="flex items-center gap-1.5 text-xs text-foreground-muted">
              <IdChip id={o.id} /> · {to("quantity", { count: o.quantity })}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "buyer",
      header: tc("buyer"),
      cell: (o) =>
        o.buyer ? (
          <div className="min-w-0">
            <p className="truncate text-foreground">
              {o.buyer.firstName} {o.buyer.lastName}
            </p>
            {o.buyer.email && <p className="truncate text-xs text-foreground-muted">{o.buyer.email}</p>}
          </div>
        ) : (
          "—"
        ),
    },
    {
      key: "store",
      header: tc("store"),
      cell: (o) =>
        o.advertisement?.store?.slug ? (
          <Link href={`/stores/${o.advertisement.store.slug}`} className="text-brand-blue hover:underline">
            {o.advertisement.store.name}
          </Link>
        ) : (
          "—"
        ),
    },
    { key: "status", header: tc("status"), cell: (o) => <StatusPill status={o.status} label={to(`status.${o.status}`)} /> },
    { key: "method", header: t("method"), cell: (o) => <StatusPill tone={o.paymentMethod === "CASH_ON_DELIVERY" ? "success" : "info"} label={t(`methods.${o.paymentMethod ?? "MOBILE_MONEY"}`)} /> },
    {
      key: "escrow",
      header: t("escrow"),
      cell: (o) => (o.escrow ? <StatusPill status={o.escrow.status} label={t(`escrowStatus.${o.escrow.status}`)} /> : <span className="text-foreground-muted">—</span>),
    },
    { key: "amount", header: tc("amount"), className: "whitespace-nowrap", cell: (o) => <span className="font-script text-lg text-brand-blue dark:text-brand-blue-light">{formatPrice(o.totalAmount, locale)}</span> },
    { key: "date", header: tc("date"), className: "whitespace-nowrap text-foreground-secondary", cell: (o) => formatDate(o.createdAt, locale) },
    {
      key: "actions",
      header: <span className="sr-only">{tc("actions")}</span>,
      className: "text-right",
      cell: (o) => (
        <Link href={`/admin/orders/${o.id}`} className={rowAction}>
          <Eye className="size-3.5" /> {tc("view")}
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader title={t("title")} subtitle={t("subtitle")} />
      <Toolbar>
        <FilterSelect<OrderStatus> ariaLabel={tc("status")} value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: to(`status.${s}`) }))} />
      </Toolbar>
      <AdminTable columns={columns} rows={list.items} rowKey={(o) => o.id} loading={list.loading} error={list.error} empty={tc("none")} footer={<ClientPagination page={list.page} pageSize={list.pageSize} total={list.total} onChange={list.setPage} />} />
    </div>
  );
}
