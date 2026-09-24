"use client";

import { CalendarClock, Loader2, Send, Trash2, Zap } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { discountPercent, formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FlashCampaign, FlashCampaignItem, FlashCampaignPhase, FlashItemStatus, Paginated, Product } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";
import { EmptyState } from "@/components/ui/EmptyState";

const PHASE_CLASS: Record<FlashCampaignPhase, string> = {
  DRAFT: "bg-surface-hover text-foreground-secondary",
  PUBLISHED: "bg-brand-sky text-brand-blue",
  SCHEDULED: "bg-brand-sky text-brand-blue dark:text-brand-blue-light",
  ACTIVE: "bg-success/15 text-success",
  ENDED: "bg-surface-hover text-foreground-muted",
  CANCELLED: "bg-danger/10 text-danger",
};
const ITEM_CLASS: Record<FlashItemStatus, string> = {
  PENDING: "bg-warning/15 text-warning",
  APPROVED: "bg-success/15 text-success",
  REJECTED: "bg-danger/10 text-danger",
};

const field = "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-brand-blue";

function ApplyForm({ campaign, listings, onDone }: { campaign: FlashCampaign; listings: Product[]; onDone: () => void }) {
  const t = useTranslations("sellerArea.flashDeals");
  const locale = useLocale();
  const { authFetch } = useAuth();
  const describeError = useAuthError();
  const taken = new Set((campaign.items ?? []).map((i) => i.advertisementId));
  const candidates = listings.filter((l) => !taken.has(l.id));
  const [listingId, setListingId] = useState(candidates[0]?.id ?? "");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const listing = candidates.find((l) => l.id === listingId);
  const pct = listing && price ? discountPercent(price, listing.price) : null;
  const tooSmall = pct !== null && (pct < campaign.minDiscountPercent || Number(price) >= Number(listing?.price));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!listing || tooSmall) return;
    const note = String(new FormData(event.currentTarget).get("note") ?? "").trim();
    setBusy(true);
    try {
      await authFetch(`flash-campaigns/${campaign.id}/applications`, { method: "POST", body: { advertisementId: listing.id, campaignPrice: Number(price), note: note || undefined } });
      toast.success(t("submitted"));
      setPrice("");
      onDone();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  if (candidates.length === 0) return <p className="text-sm text-foreground-muted">{t("noListingsLeft")}</p>;

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-border bg-background p-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-semibold text-foreground-secondary sm:col-span-2">
        {t("listing")}
        <select value={listingId} onChange={(e) => setListingId(e.target.value)} className={field}>
          {candidates.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title} — {formatPrice(l.price, locale)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-foreground-secondary">
        {t("campaignPrice")}
        <input type="number" min={1} step={100} required value={price} onChange={(e) => setPrice(e.target.value)} className={field} />
        <span className={cn("text-[11px] font-normal", tooSmall ? "text-danger" : "text-foreground-muted")}>
          {listing && t("currentPrice", { price: formatPrice(listing.price, locale) })}
          {pct !== null && ` · ${t("discount", { percent: Math.max(0, pct) })}`}
          {tooSmall && ` · ${t("tooSmall", { percent: campaign.minDiscountPercent })}`}
        </span>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-foreground-secondary">
        {t("note")}
        <input name="note" maxLength={300} placeholder={t("notePlaceholder")} className={field} />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={busy || !listing || !price || tooSmall} className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-orange px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-orange-light disabled:opacity-60">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {t("submit")}
        </button>
      </div>
    </form>
  );
}

export function FlashDealsView() {
  const t = useTranslations("sellerArea.flashDeals");
  const locale = useLocale();
  const { authFetch } = useAuth();
  const describeError = useAuthError();
  const [campaigns, setCampaigns] = useState<FlashCampaign[] | null>(null);
  const [mine, setMine] = useState<FlashCampaignItem[]>([]);
  const [listings, setListings] = useState<Product[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([
        authFetch<{ campaigns: FlashCampaign[] }>("flash-campaigns/open").then((r) => r.campaigns),
        authFetch<{ items: FlashCampaignItem[] }>("flash-campaigns/mine").then((r) => r.items),
        authFetch<Paginated<Product>>("advertisements/me", { params: { pageSize: 100, status: "PUBLISHED" } }).then((r) => r.items),
      ])
        .then(([open, items, ads]) => {
          setCampaigns(open);
          setMine(items);
          setListings(ads);
        })
        .catch(() => setCampaigns([])),
    [authFetch]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const withdraw = async (item: FlashCampaignItem) => {
    setBusyId(item.id);
    try {
      await authFetch(`flash-campaigns/${item.campaignId}/applications/${item.id}`, { method: "DELETE" });
      toast.success(t("withdrawn"));
      await load();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusyId(null);
    }
  };

  const dates = useMemo(() => (c: FlashCampaign) => t("dates", { start: formatDate(c.startsAt, locale, { dateStyle: "medium", timeStyle: "short" }), end: formatDate(c.endsAt, locale, { dateStyle: "medium", timeStyle: "short" }) }), [locale, t]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground-secondary">{t("subtitle")}</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl">{t("open")}</h2>
        {campaigns === null ? (
          <div className="h-40 animate-pulse rounded-2xl bg-surface-hover" />
        ) : campaigns.length === 0 ? (
          <EmptyState icon={CalendarClock} title={t("noneOpen")} description={t("noneOpenHint")} />
        ) : (
          campaigns.map((campaign) => (
            <article key={campaign.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 font-sans text-lg font-semibold text-foreground">
                    <Zap className="size-4 text-brand-orange" aria-hidden /> {campaign.name}
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", PHASE_CLASS[campaign.phase])}>{t(`phase.${campaign.phase}`)}</span>
                  </h3>
                  <p className="mt-1 text-sm text-foreground-secondary">{dates(campaign)}</p>
                  {campaign.description && <p className="mt-1 text-sm text-foreground-secondary">{campaign.description}</p>}
                  <p className="mt-1 text-xs font-semibold text-brand-orange">{t("minDiscount", { percent: campaign.minDiscountPercent })}</p>
                </div>
              </div>
              <div className="mt-4">
                <ApplyForm campaign={campaign} listings={listings} onDone={load} />
              </div>
            </article>
          ))
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl">{t("mine")}</h2>
        {campaigns === null ? null : mine.length === 0 ? (
          <p className="text-sm text-foreground-muted">{t("noApplications")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {mine.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-surface-hover">
                  {item.advertisement.images?.[0] && <Image src={item.advertisement.images[0]} alt="" fill sizes="48px" className="object-cover" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{item.advertisement.title}</p>
                  <p className="text-xs text-foreground-muted">
                    {(item as FlashCampaignItem & { campaign?: FlashCampaign }).campaign?.name} · {formatPrice(item.campaignPrice, locale)} · −{item.discountPercent}%
                    {item.applied && ` · ${t("livePrice")}`}
                  </p>
                  {item.reviewNote && <p className="mt-0.5 text-xs text-foreground-secondary">{t("reviewNote")}: {item.reviewNote}</p>}
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", ITEM_CLASS[item.status])}>{t(`status.${item.status}`)}</span>
                {item.status === "PENDING" && (
                  <button type="button" disabled={busyId === item.id} onClick={() => withdraw(item)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:border-danger hover:text-danger">
                    {busyId === item.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} {t("withdraw")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
