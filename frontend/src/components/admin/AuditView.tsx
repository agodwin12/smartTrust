"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useAdminList } from "@/features/admin/useAdminList";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AuditLog } from "@/types";
import { AdminHeader, AdminTable, ClientPagination, IdChip, SearchField, StatusPill, Toolbar, adminField, type Column } from "./primitives";

const ENTITY_TYPES = ["User", "Store", "Advertisement", "Category", "Order", "Payment", "Dispute", "Withdrawal", "Subscription", "SubscriptionPlan", "Review"];

export function AuditView() {
  const t = useTranslations("admin.audit");
  const tc = useTranslations("admin.common");
  const tr = useTranslations("admin.users.roles");
  const locale = useLocale();
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const list = useAdminList<AuditLog>(
    "audit-logs",
    {
      action: action ? action.toUpperCase().replace(/\s+/g, "_") : undefined,
      entityType: entityType || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    },
    { pageSize: 50 }
  );

  const columns: Column<AuditLog>[] = [
    {
      key: "action",
      header: t("action"),
      primary: true,
      cell: (log) => (
        <button type="button" onClick={() => setExpanded(expanded === log.id ? null : log.id)} className="text-left">
          <span className="font-semibold text-foreground">{log.action.replace(/_/g, " ").toLowerCase()}</span>
          {expanded === log.id && log.metadata && <pre className="mt-2 max-w-md overflow-x-auto whitespace-pre-wrap rounded-lg bg-surface-hover p-2 text-[11px] text-foreground-secondary">{JSON.stringify(log.metadata, null, 2)}</pre>}
        </button>
      ),
    },
    {
      key: "actor",
      header: t("actor"),
      cell: (log) =>
        log.actor ? (
          <div className="min-w-0">
            <p className="truncate text-foreground">
              {log.actor.firstName} {log.actor.lastName}
            </p>
            <p className="truncate text-xs text-foreground-muted">{tr(log.actor.role)}</p>
          </div>
        ) : (
          <StatusPill tone="muted" label={t("system")} />
        ),
    },
    {
      key: "entity",
      header: t("entity"),
      cell: (log) =>
        log.entityType ? (
          <span className="inline-flex items-center gap-1.5 text-foreground-secondary">
            {log.entityType} {log.entityId && <IdChip id={log.entityId} />}
          </span>
        ) : (
          "—"
        ),
    },
    { key: "ip", header: "IP", className: "font-mono text-xs text-foreground-muted", cell: (log) => log.ipAddress ?? "—" },
    { key: "date", header: tc("date"), className: "whitespace-nowrap text-foreground-secondary", cell: (log) => formatDate(log.createdAt, locale, { dateStyle: "medium", timeStyle: "short" }) },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader title={t("title")} subtitle={t("subtitle")} />
      <Toolbar>
        <SearchField value={action} onChange={setAction} placeholder={t("action")} />
        <select aria-label={t("entity")} value={entityType} onChange={(e) => setEntityType(e.target.value)} className={cn(adminField, "sm:w-auto")}>
          <option value="">{tc("all")}</option>
          {ENTITY_TYPES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-xs text-foreground-muted">
          {t("from")} <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={cn(adminField, "h-9")} />
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-foreground-muted">
          {t("to")} <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={cn(adminField, "h-9")} />
        </label>
      </Toolbar>
      <AdminTable columns={columns} rows={list.items} rowKey={(log) => log.id} loading={list.loading} error={list.error} empty={tc("none")} footer={<ClientPagination page={list.page} pageSize={list.pageSize} total={list.total} onChange={list.setPage} />} />
    </div>
  );
}
