"use client";

import { ArrowLeft, Ban, Check, Loader2, Pencil, Plus, Rocket, Search, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { canOperate } from "@/features/admin/roles";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api";
import { discountPercent, formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FlashCampaign, FlashCampaignItem, FlashItemStatus, Paginated, Product } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";
import { CampaignSheet, PHASE_TONE } from "./FlashCampaignsView";
import { AdminHeader, AdminTable, IdChip, StatusPill, adminField, adminPrimary, adminSecondary, rowAction, type Column } from "./primitives";

const ITEM_TONE: Record<FlashItemStatus, "info" | "success" | "warning" | "muted"> = { PENDING: "warning", APPROVED: "success", REJECTED: "muted" };

/** Search the public catalogue and add a listing to the campaign as APPROVED. */
function AddListing({ campaign, onAdded }: { campaign: FlashCampaign; onAdded: () => void }) {
  const t = useTranslations("admin.flash.detail");
  const locale = useLocale();
  const { authFetch } = useAuth();
  const describeError = useAuthError();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [picked, setPicked] = useState<Product | null>(null);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const inCampaign = new Set((campaign.items ?? []).map((i) => i.advertisementId));

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      apiFetch<Paginated<Product>>("advertisements", { params: { search: q, pageSize: 8 }, signal: controller.signal })
        .then((r) => setResults(r.items))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const pct = picked && price ? discountPercent(price, picked.price) : null;
  const tooSmall = pct !== null && (pct < campaign.minDiscountPercent || Number(price) >= Number(picked?.price));

  const add = async () => {
    if (!picked || tooSmall) return;
    setBusy(true);
    try {
      await authFetch(`flash-campaigns/${campaign.id}/items`, { method: "POST", body: { advertisementId: picked.id, campaignPrice: Number(price) } });
      toast.success(t("added"));
      setPicked(null);
      setPrice("");
      setQuery("");
      setResults([]);
      onAdded();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-lg">{t("addListing")}</h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-muted" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchListing")} className={cn(adminField, "w-full pl-9")} />
          {query.trim().length >= 2 && !picked && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-surface-elevated shadow-lg">
              {results.length === 0 ? (
                <li className="px-3 py-2 text-sm text-foreground-muted">{t("noResults")}</li>
              ) : (
                results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={inCampaign.has(p.id)}
                      onClick={() => {
                        setPicked(p);
                        setQuery(p.title);
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-hover disabled:opacity-50"
                    >
                      <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-surface-hover">{p.images?.[0] && <Image src={p.images[0]} alt="" fill sizes="36px" className="object-cover" />}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {p.title} <span className="text-foreground-muted">· {p.store?.name}</span>
                      </span>
                      <span className="shrink-0 font-semibold">{formatPrice(p.price, locale)}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        <input type="number" min={1} step={100} value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t("campaignPrice")} disabled={!picked} className={cn(adminField, "w-full lg:w-44")} />
        <button type="button" onClick={add} disabled={!picked || !price || tooSmall || busy} className={adminPrimary}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} {t("add")}
        </button>
      </div>
      {picked && (
        <p className={cn("mt-2 text-xs", tooSmall ? "text-danger" : "text-foreground-muted")}>
          {t("currentPrice", { price: formatPrice(picked.price, locale) })}
          {pct !== null && ` · −${Math.max(0, pct)}%`}
          {tooSmall && ` · ${t("tooSmall", { percent: campaign.minDiscountPercent })}`}
          <button
            type="button"
            onClick={() => {
              setPicked(null);
              setQuery("");
            }}
            className="ml-2 inline-flex items-center gap-1 text-brand-blue hover:underline"
          >
            <X className="size-3" /> {t("clearPick")}
          </button>
        </p>
      )}
    </section>
  );
}

export function FlashCampaignDetail({ id }: { id: string }) {
  const t = useTranslations("admin.flash");
  const td = useTranslations("admin.flash.detail");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const { user: me, authFetch } = useAuth();
  const describeError = useAuthError();
  const [campaign, setCampaign] = useState<FlashCampaign | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const editable = canOperate(me);

  const load = useCallback(
    () =>
      authFetch<{ campaign: FlashCampaign }>(`flash-campaigns/admin/${id}`)
        .then((r) => setCampaign(r.campaign))
        .catch(() => setCampaign(null)),
    [authFetch, id]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const call = async (path: string, method: "POST" | "PATCH" | "DELETE", body: unknown, done: string, key: string) => {
    setBusyId(key);
    try {
      await authFetch(path, { method, body });
      toast.success(done);
      await load();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusyId(null);
    }
  };

  if (campaign === undefined) return <div className="h-64 animate-pulse rounded-2xl bg-surface-hover" />;
  if (campaign === null) return <p className="text-sm text-foreground-muted">{tc("none")}</p>;

  const when = (iso: string) => formatDate(iso, locale, { dateStyle: "medium", timeStyle: "short" });
  const over = campaign.status === "CANCELLED" || campaign.phase === "ENDED";

  const columns: Column<FlashCampaignItem>[] = [
    {
      key: "listing",
      header: td("listing"),
      primary: true,
      cell: (item) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-surface-hover">
            {item.advertisement.images?.[0] && <Image src={item.advertisement.images[0]} alt="" fill sizes="48px" className="object-cover" />}
          </span>
          <div className="min-w-0">
            <Link href={`/products/${item.advertisement.slug}`} className="block truncate font-semibold text-foreground hover:text-brand-blue">
              {item.advertisement.title}
            </Link>
            <p className="flex items-center gap-1.5 truncate text-xs text-foreground-muted">
              <IdChip id={item.id} /> · {item.advertisement.store.name}
            </p>
            {item.note && <p className="mt-0.5 text-xs text-foreground-secondary">{td("sellerNote")}: {item.note}</p>}
          </div>
        </div>
      ),
    },
    {
      key: "prices",
      header: td("prices"),
      className: "whitespace-nowrap",
      cell: (item) => (
        <div className="text-sm">
          <p className="text-foreground-muted line-through">{formatPrice(item.applied ? item.originalPrice : item.advertisement.price, locale)}</p>
          <p className="font-semibold text-foreground">
            {formatPrice(item.campaignPrice, locale)} <span className="text-danger">−{item.discountPercent}%</span>
          </p>
          {item.applied && <p className="text-[11px] font-semibold text-success">{td("applied")}</p>}
        </div>
      ),
    },
    { key: "status", header: tc("status"), cell: (item) => <StatusPill tone={ITEM_TONE[item.status]} label={t(`status.${item.status}`)} /> },
    {
      key: "actions",
      header: <span className="sr-only">{tc("actions")}</span>,
      className: "text-right",
      cell: (item) =>
        editable && !over ? (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {item.status !== "APPROVED" && (
              <>
                <input
                  type="number"
                  min={1}
                  step={100}
                  placeholder={td("pricePlaceholder")}
                  value={prices[item.id] ?? ""}
                  onChange={(e) => setPrices((p) => ({ ...p, [item.id]: e.target.value }))}
                  className={cn(adminField, "w-32")}
                  aria-label={td("pricePlaceholder")}
                />
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => call(`flash-campaigns/${campaign.id}/items/${item.id}`, "PATCH", { status: "APPROVED", ...(prices[item.id] ? { campaignPrice: Number(prices[item.id]) } : {}) }, td("approved"), item.id)}
                  className={cn(rowAction, "border-success/40 text-success hover:border-success")}
                >
                  {busyId === item.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} {td("approve")}
                </button>
              </>
            )}
            {item.status !== "REJECTED" && (
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => {
                  const reviewNote = window.prompt(td("rejectPrompt")) ?? undefined;
                  void call(`flash-campaigns/${campaign.id}/items/${item.id}`, "PATCH", { status: "REJECTED", reviewNote: reviewNote || undefined }, td("rejected"), item.id);
                }}
                className={cn(rowAction, "border-warning/40 text-warning hover:border-warning")}
              >
                <X className="size-3.5" /> {td("reject")}
              </button>
            )}
            <button
              type="button"
              disabled={busyId === item.id}
              onClick={() => window.confirm(td("confirmRemove")) && call(`flash-campaigns/${campaign.id}/items/${item.id}`, "DELETE", undefined, td("removed"), item.id)}
              className={cn(rowAction, "border-danger/40 text-danger hover:border-danger")}
            >
              <Trash2 className="size-3.5" /> {td("remove")}
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin/flash-deals" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline">
        <ArrowLeft className="size-4" /> {td("back")}
      </Link>
      <AdminHeader
        title={campaign.name}
        subtitle={`${when(campaign.startsAt)} → ${when(campaign.endsAt)} · ≥ ${campaign.minDiscountPercent}%${campaign.description ? ` · ${campaign.description}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={PHASE_TONE[campaign.phase]} label={t(`phase.${campaign.phase}`)} />
            {editable && campaign.status !== "CANCELLED" && (
              <button type="button" onClick={() => setEditing(true)} className={adminSecondary}>
                <Pencil className="size-4" /> {tc("edit")}
              </button>
            )}
            {editable && campaign.status === "DRAFT" && (
              <button type="button" disabled={busyId === "publish"} onClick={() => call(`flash-campaigns/${campaign.id}/publish`, "POST", undefined, t("published"), "publish")} className={adminPrimary}>
                {busyId === "publish" ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />} {t("publish")}
              </button>
            )}
            {editable && campaign.status === "PUBLISHED" && campaign.phase !== "ENDED" && (
              <button type="button" disabled={busyId === "cancel"} onClick={() => window.confirm(t("confirmCancel")) && call(`flash-campaigns/${campaign.id}/cancel`, "POST", undefined, t("cancelled"), "cancel")} className={cn(adminSecondary, "border-danger/40 text-danger")}>
                {busyId === "cancel" ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />} {t("cancel")}
              </button>
            )}
          </div>
        }
      />

      {editable && !over && <AddListing campaign={campaign} onAdded={load} />}

      <AdminTable columns={columns} rows={campaign.items ?? []} rowKey={(item) => item.id} loading={false} error={null} empty={td("noItems")} />

      <CampaignSheet key={editing ? campaign.id : "closed"} editing={editing ? { mode: "edit", campaign } : null} onClose={() => setEditing(false)} onSaved={load} />
    </div>
  );
}
