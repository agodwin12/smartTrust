import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listProducts } from "@/features/catalog/api";
import { listingParams, toPage, type SearchParams } from "@/lib/search-params";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { ProductFilters } from "@/components/marketplace/ProductFilters";
import { ProductListing } from "@/components/marketplace/ProductListing";
import { PageHero } from "@/components/ui/PageHero";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return seo(locale, "/products", { title: t("allProductsTitle"), description: t("allProductsSubtitle") });
}

export default async function ProductsPage({ params, searchParams }: Props) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const lp = listingParams(sp);
  const [t, result] = await Promise.all([
    getTranslations("catalog"),
    listProducts({ page: toPage(sp.page), sort: lp.sort, minPrice: lp.minPrice, maxPrice: lp.maxPrice, condition: lp.condition, location: lp.location }),
  ]);

  return (
    <PageShell>
      <PageHero title={t("allProductsTitle")} subtitle={t("allProductsSubtitle")} crumbs={[{ label: t("allProductsTitle") }]} size="compact" />
      <Container className="py-8 sm:py-12">
        <ProductFilters total={result.total} />
        <div className="mt-6">
          <ProductListing result={result} basePath="/products" params={lp} />
        </div>
      </Container>
    </PageShell>
  );
}
