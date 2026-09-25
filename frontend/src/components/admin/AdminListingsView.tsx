"use client";

import { Archive, Eye, Loader2, Sparkles } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { canOperate } from "@/features/admin/roles";
import { useAdminList } from "@/features/admin/useAdminList";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";
import { AdminHeader, AdminTable, ClientPagination, FilterSelect, SearchField, StatusPill, Toolbar, adminField, rowAction, type Column } from "./primitives";

const STATUSES: Product["status"][] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export function AdminListingsView() {
  const t = useTranslations("admin.listings");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const { user: me, authFetch } = useAuth();
  const describeError = useAuthError();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Product["status"] | "">("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hours, setHours] = useState<Record<string, number>>({});
  const list = useAdminList<Product>("advertisements/all", { search: q || undefined, status: status || undefined });

  const act = async (id: string, path: string, method: "POST" | "DELETE", body: unknown, success: string, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    setBusyId(id);
    try {
      await authFetch(path, { method, ...(method === "POST" ? { body: body ?? {} } : {}) });
      toast.success(success);
      list.reload();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusyId(null);
    }
  };

  const columns: Column<Product>[] = [
    {
      key: "listing",
      header: t("title"),
      primary: true,
      cell: (ad) => {
        const featured = !!ad.featuredUntil && new Date(ad.featuredUntil) > new Date();
        return (
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-surface-hover">{ad.images?.[0] && <Image src={ad.images[0]} alt="" fill sizes="48px" className="object-cover" />}</span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{ad.title}</p>
              <p className="truncate text-xs text-foreground-muted">
                {ad.category?.name} · {t("views", { count: ad.viewCount })}
              </p>
              {featured && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-orange/15 px-2 py-0.5 text-[11px] font-semibold text-brand-orange">
                  <Sparkles className="size-3" /> {t("featuredUntil", { date: formatDate(ad.featuredUntil!, locale) })}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "store",
      header: tc("store"),
      cell: (ad) => (
        <Link href={`/stores/${ad.store.slug}`} className="text-brand-blue hover:underline">
          {ad.store.name}
        </Link>
      ),
    },
    { key: "status", header: tc("status"), cell: (ad) => <StatusPill status={ad.status} label={t(`statuses.${ad.status}`)} /> },
    {
      key: "price",
      header: tc("amount"),
      className: "whitespace-nowrap",
      cell: (ad) => (
        <div>
          <span className="font-bold text-lg text-brand-blue dark:text-brand-blue-light">{formatPrice(ad.price, locale)}</span>
          {ad.compareAtPrice && <p className="text-xs text-foreground-muted line-through">{formatPrice(ad.compareAtPrice, locale)}</p>}
        </div>
      ),
    },
    { key: "created", header: tc("date"), className: "whitespace-nowrap text-foreground-secondary", cell: (ad) => formatDate(ad.createdAt, locale) },
    {
      key: "actions",
      header: <span className="sr-only">{tc("actions")}</span>,
      className: "text-right",
      cell: (ad) => {
        const busy = busyId === ad.id;
        const featured = !!ad.featuredUntil && new Date(ad.featuredUntil) > new Date();
        return (
          <div className="flex flex-wrap justify-end gap-1.5">
            {ad.status === "PUBLISHED" && (
              <Link href={`/products/${ad.slug}`} className={rowAction}>
                <Eye className="size-3.5" /> {tc("view")}
              </Link>
            )}
            {canOperate(me) && ad.status === "PUBLISHED" && !featured && (
              <span className="inline-flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={720}
                  aria-label={t("featureHours")}
                  value={hours[ad.id] ?? 72}
                  onChange={(e) => setHours((h) => ({ ...h, [ad.id]: Math.max(1, Number(e.target.value) || 1) }))}
                  className={cn(adminField, "h-8 w-16 px-2 text-xs")}
                />
                <button type="button" disabled={busy} onClick={() => act(ad.id, `advertisements/${ad.id}/feature`, "POST", { durationHours: hours[ad.id] ?? 72 }, t("featured"))} className={cn(rowAction, "border-brand-orange/40 text-brand-orange hover:border-brand-orange")}>
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} {t("feature")}
                </button>
              </span>
            )}
            {canOperate(me) && featured && (
              <button type="button" disabled={busy} onClick={() => act(ad.id, `advertisements/${ad.id}/feature`, "DELETE", undefined, t("unfeatured"))} className={rowAction}>
                <Sparkles className="size-3.5" /> {t("unfeature")}
              </button>
            )}
            {canOperate(me) && ad.status !== "ARCHIVED" && (
              <button type="button" disabled={busy} onClick={() => act(ad.id, `advertisements/${ad.id}/archive`, "POST", {}, t("archived"), t("confirmArchive"))} className={cn(rowAction, "text-foreground-secondary")}>
                <Archive className="size-3.5" /> {t("archive")}
              </button>
            )}
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
        <FilterSelect<Product["status"]> ariaLabel={tc("status")} value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) }))} />
      </Toolbar>
      <AdminTable columns={columns} rows={list.items} rowKey={(ad) => ad.id} loading={list.loading} error={list.error} empty={tc("none")} footer={<ClientPagination page={list.page} pageSize={list.pageSize} total={list.total} onChange={list.setPage} />} />
    </div>
  );
}
