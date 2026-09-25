import { ArrowRight, Clock, Eye, Wallet, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AutoRail } from "@/components/market/AutoRail";
import { DealCard } from "@/components/market/DealCard";
import { SectionTitle } from "@/components/market/SectionTitle";
import type { Product } from "@/types";

export type ShowcaseGroups = { popular: Product[]; latest: Product[]; budget: Product[] };

const GROUPS: { key: keyof ShowcaseGroups; icon: LucideIcon; href: string }[] = [
  { key: "popular", icon: Eye, href: "/products?sort=popular" },
  { key: "latest", icon: Clock, href: "/new-arrivals" },
  { key: "budget", icon: Wallet, href: "/products?maxPrice=50000&sort=popular" },
];

/** Three themed rows of up to 12 listings, each an auto-sliding rail (2 per view on phones, 5 on desktop). */
export async function ProductShowcase({ groups }: { groups: ShowcaseGroups }) {
  const t = await getTranslations("market.showcase");
  const rows = GROUPS.filter(({ key }) => groups[key].length > 0);
  if (rows.length === 0) return null;

  return (
    <section aria-label={t("title")} className="market-panel p-3">
      <SectionTitle size="lg" title={t("title")} subtitle={t("subtitle")} href="/products" linkLabel={t("seeAll")} />
      <div className="mt-3 flex flex-col gap-4">
        {rows.map(({ key, icon: Icon, href }) => (
          <div key={key}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="inline-flex items-center gap-1.5 font-market text-[13px] font-bold text-market-text">
                <span className="inline-flex size-6 items-center justify-center rounded-[6px] bg-market-blue-light text-market-blue">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                {t(`groups.${key}`)}
              </h3>
              <Link href={href} className="market-link whitespace-nowrap">
                {t("seeAll")}
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
            <AutoRail label={t(`groups.${key}`)} itemClassName="w-[calc((100%-0.5rem)/2)] sm:w-[calc((100%-1rem)/3)] lg:w-[calc((100%-2rem)/5)]">
              {groups[key].slice(0, 12).map((product) => (
                <DealCard key={product.id} product={product} tone="catalog" />
              ))}
            </AutoRail>
          </div>
        ))}
      </div>
    </section>
  );
}
