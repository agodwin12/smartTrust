"use client";

import { Archive, Eye, Loader2, Package, Pencil, PlusCircle, Sparkles, Upload } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Paginated, Product, SellerDashboard } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";
import { EmptyState } from "@/components/ui/EmptyState";

type Tab = "all" | "DRAFT" | "PUBLISHED" | "ARCHIVED";
const TABS: Tab[] = ["all", "DRAFT", "PUBLISHED", "ARCHIVED"];

const STATUS_STYLES: Record<Product["status"], string> = {
  DRAFT: "bg-foreground-muted/15 text-foreground-secondary",
  PUBLISHED: "bg-success/15 text-success",
  ARCHIVED: "bg-foreground-muted/15 text-foreground-muted",
};

export function ListingsView() {
  const t = useTranslations("sellerArea.listings");
  const locale = useLocale();
  const { authFetch } = useAuth();
  const describeError = useAuthError();
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<Product[] | null>(null);
  const [dash, setDash] = useState<SellerDashboard | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [list, store] = await Promise.all([
      authFetch<Paginated<Product>>("advertisements/me", { params: { pageSize: 100, status: tab === "all" ? undefined : tab } }).then((r) => r.items).catch(() => []),
      authFetch<{ store: SellerDashboard }>("stores/me").then((r) => r.store).catch(() => null),
    ]);
    setItems(list);
    setDash(store);
  }, [authFetch, tab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void load();
  }, [load]);

  const act = async (id: string, path: string, method: "POST" | "DELETE", success: string) => {
    setBusyId(id);
    try {
      await authFetch(path, { method, ...(method === "POST" ? { body: {} } : {}) });
      toast.success(success);
      await load();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusyId(null);
    }
  };

  const sub = dash?.subscription;
  const iconButton = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-brand-blue hover:text-brand-blue disabled:opacity-60";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-foreground-secondary">{t("subtitle")}</p>
          {sub && <p className="mt-1 text-xs font-medium text-brand-blue">{t("quota", { used: sub.adsUsed, quota: sub.plan.adQuota })}</p>}
        </div>
        <Link href="/seller/listings/new" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-orange px-5 text-sm font-semibold text-white hover:bg-brand-orange-light">
          <PlusCircle className="size-4" /> {t("new")}
        </Link>
      </div>

      <div className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn("inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-colors", tab === key ? "border-brand-blue bg-brand-blue text-white" : "border-border bg-surface text-foreground-secondary hover:border-brand-blue hover:text-brand-blue")}
          >
            {t(`tabs.${key}`)}
            {key !== "all" && dash && <span className="ml-1.5 text-xs opacity-70">{dash.stats.listings[key]}</span>}
          </button>
        ))}
      </div>

      {items === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-hover" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Package} title={t("empty.title")} description={t("empty.description")} action={{ label: t("empty.action"), href: "/seller/listings/new" }} />
      ) : (
        <ul className="space-y-3">
          {items.map((ad) => {
            const featured = !!ad.featuredUntil && new Date(ad.featuredUntil) > new Date();
            const busy = busyId === ad.id;
            return (
              <li key={ad.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start gap-4">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-surface-hover">
                    {ad.images?.[0] && <Image src={ad.images[0]} alt="" fill sizes="80px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{ad.title}</p>
                    <p className="text-xs text-foreground-muted">
                      {ad.category?.name} · {formatDate(ad.createdAt, locale)} · {t("views", { count: ad.viewCount })}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLES[ad.status])}>{t(`status.${ad.status}`)}</span>
                      {featured && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange/15 px-2.5 py-0.5 text-xs font-semibold text-brand-orange">
                          <Sparkles className="size-3" /> {t("featuredUntil", { date: formatDate(ad.featuredUntil!, locale) })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-xl text-brand-blue dark:text-brand-blue-light">{formatPrice(ad.price, locale)}</p>
                    {ad.compareAtPrice && <p className="text-xs text-foreground-muted line-through">{formatPrice(ad.compareAtPrice, locale)}</p>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/seller/listings/${ad.id}/edit`} className={iconButton}>
                    <Pencil className="size-3.5" /> {t("actions.edit")}
                  </Link>
                  {ad.status === "PUBLISHED" && (
                    <Link href={`/products/${ad.slug}`} className={iconButton}>
                      <Eye className="size-3.5" /> {t("actions.view")}
                    </Link>
                  )}
                  {ad.status !== "PUBLISHED" && (
                    <button type="button" disabled={busy} onClick={() => act(ad.id, `advertisements/${ad.id}/publish`, "POST", t("published"))} className={cn(iconButton, "border-success/40 bg-success/10 text-success hover:border-success")}>
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} {t("actions.publish")}
                    </button>
                  )}
                  {ad.status === "PUBLISHED" && !featured && (
                    <button type="button" disabled={busy} onClick={() => act(ad.id, `advertisements/${ad.id}/feature`, "POST", t("featured"))} className={cn(iconButton, "border-brand-orange/40 text-brand-orange hover:border-brand-orange")}>
                      <Sparkles className="size-3.5" /> {t("actions.feature")}
                    </button>
                  )}
                  {featured && (
                    <button type="button" disabled={busy} onClick={() => act(ad.id, `advertisements/${ad.id}/feature`, "DELETE", t("unfeatured"))} className={iconButton}>
                      <Sparkles className="size-3.5" /> {t("actions.unfeature")}
                    </button>
                  )}
                  {ad.status !== "ARCHIVED" && (
                    <button type="button" disabled={busy} onClick={() => act(ad.id, `advertisements/${ad.id}/archive`, "POST", t("archived"))} className={cn(iconButton, "text-foreground-secondary")}>
                      <Archive className="size-3.5" /> {t("actions.archive")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
