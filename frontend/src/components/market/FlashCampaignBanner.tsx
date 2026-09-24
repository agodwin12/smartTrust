import { CalendarClock, Zap } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDate } from "@/lib/format";
import { CountdownTimer } from "@/components/market/CountdownTimer";
import { DealCard } from "@/components/market/DealCard";
import type { FlashCampaign, Product } from "@/types";

/** Top of /deals: the live campaign with its items, or a teaser for the next scheduled one. */
export async function FlashCampaignBanner({ campaign, upcoming }: { campaign: FlashCampaign | null; upcoming: FlashCampaign | null }) {
  const [t, locale] = await Promise.all([getTranslations("market.flash"), getLocale()]);
  const live = campaign && campaign.phase === "ACTIVE" ? campaign : null;
  if (!live && !upcoming) return null;
  const shown = live ?? upcoming!;

  return (
    <section
      aria-label={shown.name}
      className="rounded-market border border-market-flash-border bg-[linear-gradient(90deg,var(--market-flash-from),var(--market-flash-to))] p-3 shadow-market font-market sm:p-4"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-market-red text-white">
          {live ? <Zap className="size-5" fill="currentColor" aria-hidden /> : <CalendarClock className="size-5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-market-red">{live ? t("liveNow") : t("comingSoon")}</p>
          <h2 className="truncate font-market text-[18px] font-extrabold tracking-normal text-market-ink sm:text-[20px]">{shown.name}</h2>
          <p className="text-[12px] text-market-text">
            {shown.description ?? (live ? t("campaignSubtitle") : "")}
            {!live && ` ${t("startsOn", { date: formatDate(shown.startsAt, locale, { dateStyle: "medium", timeStyle: "short" }) })}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-market-muted">{live ? t("endsIn") : t("startsIn")}</span>
          <CountdownTimer until={live ? live.endsAt : shown.startsAt} label={live ? t("endsIn") : t("startsIn")} />
        </div>
      </div>

      {live && live.items && live.items.length > 0 && (
        <ul className="no-scrollbar mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto lg:grid lg:grid-cols-4 lg:overflow-visible xl:grid-cols-6">
          {live.items.map((item) => (
            <li key={item.id} className="w-[150px] shrink-0 snap-start lg:w-auto">
              <DealCard product={item.advertisement as unknown as Product} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
