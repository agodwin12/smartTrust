import type { Metadata } from "next";
import { CalendarDays, Eye, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { getProduct, getStore, listProducts } from "@/features/catalog/api";
import { formatDate } from "@/lib/format";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { BuyBox } from "@/components/marketplace/BuyBox";
import { ProductGallery } from "@/components/marketplace/ProductGallery";
import { ProductGrid } from "@/components/marketplace/ProductGrid";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { seo } from "@/lib/seo";
import { JsonLd, breadcrumbJsonLd, productJsonLd } from "@/components/seo/JsonLd";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Product", robots: { index: false } };
  return seo(locale, `/products/${slug}`, { title: product.title, description: product.description?.slice(0, 160) }, { images: product.images?.slice(0, 1) });
}

export default async function ProductPage({ params }: Props) {
  const { locale: paramLocale, slug } = await params;
  setRequestLocale(paramLocale);
  const product = await getProduct(slug);
  if (!product) notFound();

  const [t, tc, tp, locale, fromStore, inCategory, store] = await Promise.all([
    getTranslations("product"),
    getTranslations("catalog"),
    getTranslations("products"),
    getLocale(),
    listProducts({ storeId: product.storeId, pageSize: 5 }),
    listProducts({ categorySlug: product.category.slug, pageSize: 5 }),
    getStore(product.store.slug),
  ]);
  const related = (items: typeof fromStore.items) => items.filter((p) => p.id !== product.id).slice(0, 4);
  const moreFromStore = related(fromStore.items);
  const moreInCategory = related(inCategory.items).filter((p) => !moreFromStore.some((m) => m.id === p.id));

  return (
    <PageShell>
      <Container className="py-6 sm:py-8">
        <JsonLd
          data={[
            productJsonLd(product, store, locale),
            breadcrumbJsonLd(locale, [
              { name: tc("categoriesTitle"), path: "/categories" },
              { name: product.category.name, path: `/categories/${product.category.slug}` },
              { name: product.title, path: `/products/${product.slug}` },
            ]),
          ]}
        />
        <Breadcrumbs
          items={[{ label: tc("categoriesTitle"), href: "/categories" }, { label: product.category.name, href: `/categories/${product.category.slug}` }, { label: product.title }]}
          className="mb-5"
        />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
          <div className="min-w-0">
            <ProductGallery images={product.images ?? []} title={product.title} />
            <h1 className="mt-6 text-3xl sm:text-4xl">{product.title}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-muted">
              <span className="inline-flex items-center gap-1"><Eye className="size-3.5" /> {t("views", { count: product.viewCount })}</span>
              <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" /> {t("listedOn", { date: formatDate(product.createdAt, locale) })}</span>
              {product.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" /> {product.location}</span>}
              <span className="rounded-full bg-surface-hover px-2 py-0.5 font-medium text-foreground-secondary">{tp(`condition.${product.condition}`)}</span>
            </p>
            {product.description && (
              <section className="mt-8">
                <h2 className="text-2xl">{t("description")}</h2>
                <p className="mt-3 whitespace-pre-line text-[17px] leading-relaxed text-foreground sm:text-lg">{product.description}</p>
              </section>
            )}
          </div>
          <div className="lg:sticky lg:top-28 lg:self-start">
            <BuyBox product={product} store={store} />
          </div>
        </div>
      </Container>
      {moreFromStore.length > 0 && (
        <section className="border-t border-border bg-surface py-12">
          <Container>
            <SectionHeading title={t("moreFromStore", { name: product.store.name })} href={`/stores/${product.store.slug}`} linkLabel={t("viewStore")} />
            <ProductGrid products={moreFromStore} />
          </Container>
        </section>
      )}
      {moreInCategory.length > 0 && (
        <section className="py-12">
          <Container>
            <SectionHeading title={t("moreInCategory", { name: product.category.name })} href={`/categories/${product.category.slug}`} linkLabel={tc("empty.action")} />
            <ProductGrid products={moreInCategory} />
          </Container>
        </section>
      )}
    </PageShell>
  );
}
