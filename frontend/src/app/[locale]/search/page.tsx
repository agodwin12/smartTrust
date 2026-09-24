import type { Metadata } from "next";
import { Search } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listProducts, listStores } from "@/features/catalog/api";
import { first, type SearchParams } from "@/lib/search-params";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { SearchResults } from "@/components/search/SearchResults";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHero } from "@/components/ui/PageHero";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  const t = await getTranslations({ locale, namespace: "search" });
  const q = first(sp.q)?.trim();
  return seo(locale, "/search", { title: q ? t("title", { query: q }) : t("prompt"), robots: { index: false } }, { noIndex: true });
}

export default async function SearchPage({ params, searchParams }: Props) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const t = await getTranslations("search");
  const q = first(sp.q)?.trim() ?? "";
  const category = first(sp.category)?.trim() || undefined;

  if (!q) {
    return (
      <PageShell>
        <PageHero title={t("prompt")} subtitle={t("promptDescription")} size="compact" />
        <Container className="py-12">
          <EmptyState icon={Search} title={t("prompt")} description={t("promptDescription")} action={{ label: t("promptDescription") ? "Products" : "", href: "/products" }} />
        </Container>
      </PageShell>
    );
  }

  const [products, stores] = await Promise.all([listProducts({ search: q, categorySlug: category, pageSize: 24 }), listStores({ search: q, pageSize: 12 })]);

  return (
    <PageShell>
      <PageHero title={t("title", { query: q })} size="compact" />
      <Container className="py-8 sm:py-12">
        <SearchResults query={q} products={products.items} productsTotal={products.total} stores={stores.items} storesTotal={stores.total} />
      </Container>
    </PageShell>
  );
}
