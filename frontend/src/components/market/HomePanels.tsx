import { BadgeCheck, Star } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { formatCompactNumber, formatPrice, initials } from "@/lib/format";
import { categoryIcon } from "@/components/market/CategoryIcon";
import { SectionTitle } from "@/components/market/SectionTitle";
import type { Category, Product, Store } from "@/types";

function Panel({ title, subtitle, href, linkLabel, empty, children }: { title: string; subtitle: string; href: string; linkLabel: string; empty: boolean; children: ReactNode }) {
  return (
    <section aria-label={title} className="market-panel p-3">
      <SectionTitle title={title} subtitle={subtitle} href={href} linkLabel={linkLabel} />
      <div className="mt-2.5">{empty ? <EmptyNote /> : children}</div>
    </section>
  );
}

async function EmptyNote() {
  const t = await getTranslations("market.panels");
  return <p className="rounded-[8px] border border-dashed border-market-border px-3 py-4 text-center text-[11px] text-market-muted">{t("empty")}</p>;
}

/** The three compact desktop panels under the trust strip (design guide §15). */
export async function HomePanels({ subcategories, newest, stores }: { subcategories: Category[]; newest: Product[]; stores: Store[] }) {
  const [t, tp, locale] = await Promise.all([getTranslations("market.panels"), getTranslations("products"), getLocale()]);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Panel title={t("topCategories.title")} subtitle={t("topCategories.subtitle")} href="/categories" linkLabel={t("seeAll")} empty={subcategories.length === 0}>
        <ul className="no-scrollbar flex gap-2 overflow-x-auto sm:grid sm:grid-cols-6 sm:overflow-visible lg:grid-cols-3 xl:grid-cols-6">
          {subcategories.slice(0, 6).map((category) => {
            const Icon = categoryIcon(category.slug);
            return (
              <li key={category.id} className="w-[74px] shrink-0 sm:w-auto">
                <Link href={`/categories/${category.slug}`} className="group flex flex-col items-center gap-1 text-center">
                  <span className="relative block h-[56px] w-full overflow-hidden rounded-[7px] border border-market-border-soft bg-market-blue-light/60 transition-transform group-hover:scale-[1.03]">
                    {category.imageUrl ? (
                      <Image src={category.imageUrl} alt="" fill sizes="80px" loading="lazy" className="object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-market-blue">
                        <Icon className="size-5" aria-hidden />
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-1 w-full text-[10px] font-semibold text-market-text transition-colors group-hover:text-market-blue">{category.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title={t("newest.title")} subtitle={t("newest.subtitle")} href="/new-arrivals" linkLabel={t("seeAll")} empty={newest.length === 0}>
        <ul className="grid grid-cols-4 gap-2">
          {newest.slice(0, 4).map((product) => (
            <li key={product.id} className="min-w-0">
              <Link href={`/products/${product.slug}`} className="group flex flex-col gap-1">
                <span className="relative block h-[64px] w-full overflow-hidden rounded-[7px] border border-market-border-soft bg-market-blue-light/60">
                  {product.images?.[0] && <Image src={product.images[0]} alt="" fill sizes="100px" loading="lazy" className="object-cover transition-transform group-hover:scale-[1.04]" />}
                  <span className="absolute left-1 top-1 rounded-[4px] bg-market-navy/85 px-1 text-[8px] font-bold uppercase leading-4 text-white">{tp(`condition.${product.condition}`)}</span>
                </span>
                <span className="line-clamp-1 text-[10.5px] font-semibold leading-tight text-market-text transition-colors group-hover:text-market-blue">{product.title}</span>
                <span className="text-[11px] font-extrabold leading-none text-market-red">{formatPrice(product.price, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={t("stores.title")} subtitle={t("stores.subtitle")} href="/stores" linkLabel={t("seeAll")} empty={stores.length === 0}>
        <ul className="grid grid-cols-4 gap-2">
          {stores.slice(0, 4).map((store) => (
            <li key={store.id} className="min-w-0">
              <Link href={`/stores/${store.slug}`} className="group flex flex-col items-center gap-1 rounded-[7px] border border-market-border-soft bg-market-canvas px-1 py-2 text-center transition-colors hover:border-market-blue">
                <span className="relative inline-flex size-9 items-center justify-center overflow-hidden rounded-full bg-market-navy text-[11px] font-extrabold text-white">
                  {store.logoUrl ? <Image src={store.logoUrl} alt="" fill sizes="36px" loading="lazy" className="object-cover" /> : initials(store.name)}
                </span>
                <span className="line-clamp-1 w-full text-[10.5px] font-bold leading-tight text-market-ink transition-colors group-hover:text-market-blue">{store.name}</span>
                {typeof store.productCount === "number" ? (
                  <span className="text-[9.5px] text-market-muted">{t("products", { count: formatCompactNumber(store.productCount, locale) })}</span>
                ) : (
                  store.location && <span className="line-clamp-1 text-[9.5px] text-market-muted">{store.location}</span>
                )}
                {typeof store.rating === "number" ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-market-text">
                    <Star className="size-3 fill-market-orange text-market-orange" aria-hidden />
                    {store.rating.toFixed(1)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-market-blue">
                    <BadgeCheck className="size-3" aria-hidden />
                    {t("verified")}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
