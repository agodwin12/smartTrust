import type { Metadata } from "next";
import { Search } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listStores } from "@/features/catalog/api";
import { getPathname } from "@/i18n/navigation";
import { first, toPage, type SearchParams } from "@/lib/search-params";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { StoreCard } from "@/components/marketplace/StoreCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHero } from "@/components/ui/PageHero";
import { Pagination } from "@/components/ui/Pagination";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "stores" });
  return seo(locale, "/stores", { title: t("directoryTitle"), description: t("directorySubtitle") });
}

export default async function StoresPage({ params, searchParams }: Props) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const q = first(sp.q)?.trim() ?? "";
  const [t, result] = await Promise.all([getTranslations("stores"), listStores({ page: toPage(sp.page), search: q || undefined })]);

  return (
    <PageShell>
      <PageHero title={t("directoryTitle")} subtitle={t("directorySubtitle")} crumbs={[{ label: t("directoryTitle") }]} size="compact">
        <form action={getPathname({ href: "/stores", locale })} className="flex max-w-md gap-2">
          <input name="q" defaultValue={q} placeholder={t("searchPlaceholder")} aria-label={t("searchPlaceholder")} className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3.5 text-sm outline-none focus:border-brand-blue" />
          <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white hover:bg-brand-blue-light">
            <Search className="size-4" />
          </button>
        </form>
      </PageHero>
      <Container className="py-8 sm:py-12">
        {result.items.length === 0 ? (
          <EmptyState title={t("noStores")} action={{ label: t("directoryTitle"), href: "/stores" }} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {result.items.map((store) => (
              <li key={store.id}>
                <StoreCard store={store} />
              </li>
            ))}
          </ul>
        )}
        <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/stores" params={{ q: q || undefined }} />
      </Container>
    </PageShell>
  );
}
