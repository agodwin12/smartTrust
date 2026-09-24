import { LayoutGrid, MoreHorizontal } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { categoryIcon } from "@/components/market/CategoryIcon";
import type { Category } from "@/types";

const row = "flex h-8 items-center gap-2.5 px-3 text-[12px] font-medium text-market-text transition-colors hover:bg-market-blue-light hover:text-market-blue";

/** Desktop-only department list (design guide §9): blue title bar, 32px rows, one icon per category. */
export async function CategorySidebar({ categories, className }: { categories: Category[]; className?: string }) {
  const t = await getTranslations("market.sidebar");

  return (
    <nav aria-label={t("title")} className={cn("market-panel flex-col", className)}>
      <Link href="/categories" className="flex h-9 shrink-0 items-center gap-2 bg-market-blue px-3 text-[12px] font-bold text-white transition-colors hover:bg-market-navy">
        <LayoutGrid className="size-4" aria-hidden />
        {t("title")}
      </Link>
      <ul className="py-1">
        {categories.map((category) => {
          const Icon = categoryIcon(category.slug);
          return (
            <li key={category.id}>
              <Link href={`/categories/${category.slug}`} className={row}>
                <Icon className="size-4 shrink-0 text-market-blue" aria-hidden />
                <span className="truncate">{category.name}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link href="/categories" className={row}>
            <MoreHorizontal className="size-4 shrink-0 text-market-blue" aria-hidden />
            <span className="truncate">{t("other")}</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
