"use client";

import { ExternalLink, Loader2, Power, PowerOff } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { canOperate } from "@/features/admin/roles";
import { useAdminList } from "@/features/admin/useAdminList";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { formatDate, formatPrice, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminStore } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";
import { AdminHeader, AdminTable, ClientPagination, FilterSelect, SearchField, StatusPill, Toolbar, rowAction, type Column } from "./primitives";

const STATUSES: AdminStore["status"][] = ["PENDING", "ACTIVE", "SUSPENDED"];

export function StoresView() {
  const t = useTranslations("admin.stores");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const { user: me, authFetch } = useAuth();
  const describeError = useAuthError();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<AdminStore["status"] | "">("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const list = useAdminList<AdminStore>("stores/all", { search: q || undefined, status: status || undefined });

  const setStoreStatus = async (store: AdminStore, next: AdminStore["status"]) => {
    if (next === "SUSPENDED" && !window.confirm(t("confirmSuspend"))) return;
    setBusyId(store.id);
    try {
      await authFetch(`stores/${store.id}/status`, { method: "PATCH", body: { status: next } });
      toast.success(t("updated"));
      list.reload();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusyId(null);
    }
  };

  const columns: Column<AdminStore>[] = [
    {
      key: "store",
      header: tc("store"),
      primary: true,
      cell: (s) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-blue/10 text-xs font-bold text-brand-blue">
            {s.logoUrl ? <Image src={s.logoUrl} alt="" fill sizes="40px" className="object-cover" /> : initials(s.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{s.name}</p>
            <p className="truncate text-xs text-foreground-muted">{s.location ?? s.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "owner",
      header: t("owner"),
      cell: (s) => (
        <div className="min-w-0">
          <p className="truncate text-foreground">
            {s.owner.firstName} {s.owner.lastName}
          </p>
          <a href={`mailto:${s.owner.email}`} className="truncate text-xs text-brand-blue hover:underline">
            {s.owner.email}
          </a>
        </div>
      ),
    },
    { key: "status", header: tc("status"), cell: (s) => <StatusPill status={s.status} label={t(`statuses.${s.status}`)} /> },
    { key: "listings", header: t("listings"), className: "text-foreground-secondary", cell: (s) => s._count.advertisements },
    { key: "balance", header: t("balance"), className: "whitespace-nowrap", cell: (s) => <span className="font-script text-lg text-brand-blue dark:text-brand-blue-light">{formatPrice(s.wallet?.balance ?? 0, locale)}</span> },
    { key: "created", header: tc("date"), className: "whitespace-nowrap text-foreground-secondary", cell: (s) => formatDate(s.createdAt, locale) },
    {
      key: "actions",
      header: <span className="sr-only">{tc("actions")}</span>,
      className: "text-right",
      cell: (s) => {
        const busy = busyId === s.id;
        return (
          <div className="flex flex-wrap justify-end gap-1.5">
            <Link href={`/stores/${s.slug}`} className={rowAction}>
              <ExternalLink className="size-3.5" /> {tc("view")}
            </Link>
            {canOperate(me) &&
              (s.status === "ACTIVE" ? (
                <button type="button" disabled={busy} onClick={() => setStoreStatus(s, "SUSPENDED")} className={cn(rowAction, "border-danger/40 text-danger hover:border-danger")}>
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <PowerOff className="size-3.5" />} {t("suspend")}
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={() => setStoreStatus(s, "ACTIVE")} className={cn(rowAction, "border-success/40 text-success hover:border-success")}>
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />} {t("activate")}
                </button>
              ))}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader title={t("title")} subtitle={t("subtitle")} />
      <Toolbar>
        <SearchField value={q} onChange={setQ} />
        <FilterSelect<AdminStore["status"]> ariaLabel={tc("status")} value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) }))} />
      </Toolbar>
      <AdminTable columns={columns} rows={list.items} rowKey={(s) => s.id} loading={list.loading} error={list.error} empty={tc("none")} footer={<ClientPagination page={list.page} pageSize={list.pageSize} total={list.total} onChange={list.setPage} />} />
    </div>
  );
}
