import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAllCategories, getCategory, getHeroProducts, listProducts } from "@/features/catalog/api";
import { listingParams, toPage, type SearchParams } from "@/lib/search-params";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { CategoryChips } from "@/components/marketplace/CategoryChips";
import { ProductFilters } from "@/components/marketplace/ProductFilters";
import { ProductGrid } from "@/components/marketplace/ProductGrid";
import { ProductListing } from "@/components/marketplace/ProductListing";
import { PageHero } from "@/components/ui/PageHero";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = await getCategory(slug);
  return seo(locale, `/categories/${slug}`, { title: category?.name ?? "Category" }, category?.imageUrl ? { images: [category.imageUrl] } : {});
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ locale, slug }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const category = await getCategory(slug);
  if (!category) notFound();

  const lp = listingParams(sp);
  const page = toPage(sp.page);
  const [t, tc, result, hero, all] = await Promise.all([
    getTranslations("catalog"),
    getTranslations("common"),
    listProducts({ categorySlug: slug, page, sort: lp.sort, minPrice: lp.minPrice, maxPrice: lp.maxPrice, condition: lp.condition, location: lp.location }),
    getHeroProducts(category.id, 4),
    getAllCategories(),
  ]);

  const parent = category.parentId ? all.find((c) => c.id === category.parentId) : undefined;
  const chips = parent ? all.filter((c) => c.parentId === parent.id) : (category.children ?? all.filter((c) => c.parentId === category.id));
  const crumbs = [{ label: t("categoriesTitle"), href: "/categories" }, ...(parent ? [{ label: parent.name, href: `/categories/${parent.slug}` }] : []), { label: category.name }];

  return (
    <PageShell>
      <PageHero title={category.name} subtitle={t("results", { count: result.total })} crumbs={crumbs} image={category.imageUrl} size="compact">
        {chips.length > 0 && (
          <CategoryChips categories={chips} activeSlug={parent ? slug : undefined} allHref={parent ? `/categories/${parent.slug}` : `/categories/${slug}`} allLabel={tc("all")} />
        )}
      </PageHero>
      <Container className="py-8 sm:py-12">
        {hero.length > 0 && (
          <section className="mb-10">
            <SectionHeading title={t("featuredIn", { name: category.name })} />
            <ProductGrid products={hero} priorityCount={4} />
          </section>
        )}
        <ProductFilters total={result.total} />
        <div className="mt-6">
          <ProductListing result={result} basePath={`/categories/${slug}`} params={lp} priorityCount={hero.length > 0 ? 0 : 4} />
        </div>
      </Container>
    </PageShell>
  );
}
