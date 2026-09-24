import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { seo } from "@/lib/seo";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/components/seo/JsonLd";
import { getHomeData } from "@/features/home/getHomeData";
import { EscrowFlow } from "@/components/home/EscrowFlow";
import { PageShell } from "@/components/layout/PageShell";
import { CategorySidebar } from "@/components/market/CategorySidebar";
import { CategoryStrip } from "@/components/market/CategoryStrip";
import { FlashDeals } from "@/components/market/FlashDeals";
import { HeroBanner } from "@/components/market/HeroBanner";
import { HomePanels } from "@/components/market/HomePanels";
import { MarketContainer } from "@/components/market/MarketContainer";
import { MarketTrustStrip } from "@/components/market/MarketTrustStrip";
import { ProductShowcase } from "@/components/market/ProductShowcase";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return seo(locale, "/");
}

/**
 * Jumia-style marketplace home (images/SMART_MARKET_DESIGN_GUIDE.md):
 * sidebar + hero / category strip / flash deals, the trust strip, three compact panels, a
 * 15-listing showcase (three rows of five) and the animated escrow walkthrough before the footer.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { categories, subcategories, heroProducts, deals, newest, stores, showcase, flashCurrent, flashUpcoming } = await getHomeData();

  return (
    <PageShell quickLinks={false} className="bg-market-canvas font-market">
      <JsonLd data={[websiteJsonLd(locale), organizationJsonLd()]} />
      <MarketContainer className="flex flex-col gap-2.5 py-2.5 lg:gap-3 lg:py-3">
        <div className="flex items-stretch gap-3">
          <CategorySidebar categories={categories} className="hidden w-[205px] shrink-0 lg:flex" />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 lg:gap-3">
            <HeroBanner products={heroProducts} />
            <CategoryStrip categories={categories} />
            <FlashDeals products={deals} campaign={flashCurrent} upcoming={flashUpcoming} />
          </div>
        </div>
        <MarketTrustStrip />
        <HomePanels subcategories={subcategories} newest={newest} stores={stores} />
        <ProductShowcase groups={showcase} />
      </MarketContainer>
      <EscrowFlow />
    </PageShell>
  );
}
