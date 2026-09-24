import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getStore, listProducts } from "@/features/catalog/api";
import { listingParams, toPage, type SearchParams } from "@/lib/search-params";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { ProductFilters } from "@/components/marketplace/ProductFilters";
import { ProductListing } from "@/components/marketplace/ProductListing";
import { StoreHeader } from "@/components/marketplace/StoreHeader";
import { StoreReviews } from "@/components/marketplace/StoreReviews";
import { seo } from "@/lib/seo";
import { JsonLd, storeJsonLd } from "@/components/seo/JsonLd";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const store = await getStore(slug);
  return seo(locale, `/stores/${slug}`, { title: store?.name ?? "Store", description: store?.description?.slice(0, 160) }, store?.logoUrl || store?.bannerUrl ? { images: [store.bannerUrl ?? store.logoUrl ?? ""] } : {});
}

export default async function StorePage({ params, searchParams }: Props) {
  const [{ locale, slug }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const store = await getStore(slug);
  if (!store) notFound();

  const lp = listingParams(sp);
  const [t, result] = await Promise.all([
    getTranslations("stores"),
    listProducts({ storeId: store.id, page: toPage(sp.page), sort: lp.sort, minPrice: lp.minPrice, maxPrice: lp.maxPrice, condition: lp.condition }),
  ]);

  return (
    <PageShell>
      <JsonLd data={storeJsonLd(store, locale)} />
      <StoreHeader store={store} listingCount={result.total} />
      <Container className="py-8 sm:py-12">
        <ProductFilters total={result.total} showLocation={false} />
        <div className="mt-6">
          <ProductListing result={result} basePath={`/stores/${slug}`} params={lp} emptyAction={{ label: t("directoryTitle"), href: "/stores" }} />
        </div>
      </Container>
      <StoreReviews slug={slug} rating={store.rating} />
    </PageShell>
  );
}
