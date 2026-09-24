import { ArrowRight, Zap } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CountdownTimer } from "@/components/market/CountdownTimer";
import { DealCard } from "@/components/market/DealCard";
import { SectionTitle } from "@/components/market/SectionTitle";
import type { FlashCampaign, Product } from "@/types";

type FlashDealsProps = {
  /** Seller-discount listings (compare-at price set), the fallback when no campaign runs. */
  products: Product[];
  /** Back-office campaign running now: its items replace the seller discounts. */
  campaign?: FlashCampaign | null;
  /** Next scheduled campaign, announced with a countdown while nothing is live. */
  upcoming?: FlashCampaign | null;
};

/** Pale-orange deals block (design guide §12 / §20): six compact tiles on wide screens, a snap rail on phones. */
export async function FlashDeals({ products, campaign, upcoming }: FlashDealsProps) {
  const t = await getTranslations("market.flash");
  const live = campaign && campaign.phase === "ACTIVE" && (campaign.items?.length ?? 0) > 0 ? campaign : null;
  const items: Product[] = live ? live.items!.map((item) => item.advertisement as unknown as Product) : products;
  const deals = items.slice(0, 6);

  const title = live ? live.name : t("title");
  const subtitle = live ? (live.description ?? t("campaignSubtitle")) : upcoming ? t("nextSale", { name: upcoming.name }) : t("subtitle");
  const countdown = live ? { until: live.endsAt, label: t("endsIn") } : upcoming ? { until: upcoming.startsAt, label: t("startsIn") } : { until: null, label: t("refreshIn") };

  return (
    <section
      aria-label={title}
      className="rounded-market border border-market-flash-border bg-[linear-gradient(90deg,var(--market-flash-from),var(--market-flash-to))] p-2.5 shadow-market lg:p-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <SectionTitle
          size="lg"
          title={title}
          subtitle={subtitle}
          className="min-w-0 flex-1"
          icon={
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-market-red text-white">
              <Zap className="size-4" fill="currentColor" aria-hidden />
            </span>
          }
        />
        <div className="flex items-center gap-2">
          <span className="hidden text-[10px] font-bold uppercase tracking-wide text-market-muted sm:inline">{countdown.label}</span>
          <CountdownTimer until={countdown.until} label={countdown.label} />
        </div>
        <Link href="/deals" className="market-link hidden whitespace-nowrap sm:inline-flex">
          {t("seeAll")}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      {deals.length === 0 ? (
        <div className="mt-2.5 rounded-[8px] border border-dashed border-market-flash-border bg-market-surface/70 px-3 py-4 text-center text-[12px] text-market-text">
          <p>{t("empty")}</p>
          <Link href="/products" className="market-link mt-1.5">
            {t("browse")}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : (
        <ul className="no-scrollbar mt-2.5 flex snap-x snap-mandatory gap-2 overflow-x-auto lg:grid lg:grid-cols-3 lg:overflow-visible xl:grid-cols-6">
          {deals.map((product) => (
            <li key={product.id} className="w-[140px] shrink-0 snap-start lg:w-auto">
              <DealCard product={product} />
            </li>
          ))}
        </ul>
      )}

      <Link href="/deals" className="market-link mt-2 sm:hidden">
        {t("seeAll")}
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </section>
  );
}
