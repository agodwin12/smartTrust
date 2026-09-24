import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAllCategories, getRootCategories } from "@/features/catalog/api";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { PageHero } from "@/components/ui/PageHero";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return seo(locale, "/categories", { title: t("categoriesTitle"), description: t("categoriesSubtitle") });
}

export default async function CategoriesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tc, roots, all] = await Promise.all([getTranslations("catalog"), getTranslations("categories"), getRootCategories(), getAllCategories()]);
  const childrenOf = (id: string) => all.filter((c) => c.parentId === id);

  return (
    <PageShell>
      <PageHero title={t("categoriesTitle")} subtitle={t("categoriesSubtitle")} crumbs={[{ label: t("categoriesTitle") }]} size="compact" />
      <Container className="py-8 sm:py-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {roots.map((category) => (
            <section key={category.id} className="overflow-hidden rounded-2xl border border-border bg-surface transition-[border-color,box-shadow] hover:border-brand-blue/50 hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)]">
              <Link href={`/categories/${category.slug}`} className="group relative block aspect-[16/9] bg-surface-hover">
                {category.imageUrl && (
                  <Image src={category.imageUrl} alt={category.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(7,11,18,0.75),transparent_60%)]" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <h2 className="text-2xl">{category.name}</h2>
                  <p className="text-xs text-white/80">{tc("productCount", { count: category.productCount ?? 0 })}</p>
                </div>
              </Link>
              {childrenOf(category.id).length > 0 && (
                <div className="flex flex-wrap gap-2 p-4">
                  {childrenOf(category.id).map((child) => (
                    <Link key={child.id} href={`/categories/${child.slug}`} className="inline-flex h-8 items-center rounded-full border border-border px-3 text-xs font-medium text-foreground-secondary transition-colors hover:border-brand-blue hover:text-brand-blue">
                      {child.name}
                      {typeof child.productCount === "number" && <span className="ml-1 opacity-60">{child.productCount}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </Container>
    </PageShell>
  );
}
