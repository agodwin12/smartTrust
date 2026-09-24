import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { categoryIcon } from "@/components/market/CategoryIcon";
import type { Category } from "@/types";

/** Circular department shortcuts under the hero (design guide §11 / §19): one row on desktop, a rail on phones. */
export async function CategoryStrip({ categories }: { categories: Category[] }) {
  const t = await getTranslations("market.categories");
  const items = categories.slice(0, 12);
  if (items.length === 0) return null;

  return (
    <section aria-label={t("label")} className="market-panel px-2 py-2.5 lg:px-3">
      <ul className="no-scrollbar flex gap-1 overflow-x-auto lg:justify-between lg:gap-0 lg:overflow-visible">
        {items.map((category) => {
          const Icon = categoryIcon(category.slug);
          return (
            <li key={category.id} className="w-[66px] shrink-0 lg:w-[88px] lg:shrink">
              <Link href={`/categories/${category.slug}`} className="group flex flex-col items-center gap-1.5 rounded-[8px] px-1 py-1 text-center transition-colors hover:bg-market-blue-light">
                <span className="relative size-[46px] overflow-hidden rounded-full bg-market-blue-light ring-1 ring-market-border transition-transform group-hover:scale-105 lg:size-[54px]">
                  {category.imageUrl ? (
                    <Image src={category.imageUrl} alt="" fill sizes="54px" className="object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-market-blue">
                      <Icon className="size-5" aria-hidden />
                    </span>
                  )}
                </span>
                <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-market-text lg:text-[11px]">{category.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
