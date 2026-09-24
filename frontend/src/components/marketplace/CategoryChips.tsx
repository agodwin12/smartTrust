import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

type CategoryChipsProps = {
  categories: Category[];
  activeSlug?: string;
  allHref?: string;
  allLabel?: string;
  className?: string;
};

/** Horizontal pill list for sub-categories (scrolls on phones, wraps on desktop). */
export function CategoryChips({ categories, activeSlug, allHref, allLabel, className }: CategoryChipsProps) {
  const pill = "inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-colors";
  const idle = "border-border bg-surface text-foreground-secondary hover:border-brand-blue hover:text-brand-blue dark:hover:text-brand-blue-light";
  const active = "border-brand-blue bg-brand-blue text-white";

  return (
    <div className={cn("scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0", className)}>
      {allHref && allLabel && (
        <Link href={allHref} className={cn(pill, activeSlug ? idle : active)}>
          {allLabel}
        </Link>
      )}
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/categories/${category.slug}`}
          className={cn(pill, category.slug === activeSlug ? active : idle)}
        >
          {category.name}
          {typeof category.productCount === "number" && (
            <span className="ml-1.5 text-xs opacity-70">{category.productCount}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
