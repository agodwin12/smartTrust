"use client";

import { ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

type MarketSearchProps = {
  categories?: Category[];
  /** Show the "All categories" select (desktop header). */
  withCategory?: boolean;
  className?: string;
};

/** Header search (design guide §8): flat 7px field, optional department select, orange submit. */
export function MarketSearch({ categories = [], withCategory = false, className }: MarketSearchProps) {
  const t = useTranslations("nav");
  const tm = useTranslations("market.header");
  const router = useRouter();
  const id = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}${category ? `&category=${encodeURIComponent(category)}` : ""}`);
    } else if (category) {
      router.push(`/categories/${category}`);
    }
  };

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className={cn(
        "flex h-10 items-stretch overflow-hidden rounded-[7px] bg-white text-market-ink shadow-[inset_0_0_0_1px_var(--market-border)] transition-shadow focus-within:shadow-[0_0_0_2px_var(--market-orange)] dark:bg-market-surface",
        className
      )}
    >
      <label htmlFor={id} className="sr-only">
        {t("searchLabel")}
      </label>
      <span className="flex items-center pl-3 text-market-muted">
        <Search className="size-4" aria-hidden />
      </span>
      <input
        id={id}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchPlaceholder")}
        autoComplete="off"
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-[13px] text-market-ink outline-none placeholder:text-market-muted"
      />
      {withCategory && categories.length > 0 && (
        <span className="relative hidden items-center border-l border-market-border lg:flex">
          <select
            aria-label={tm("allCategories")}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-full max-w-[170px] cursor-pointer appearance-none bg-transparent pl-3 pr-7 text-[12px] font-medium text-market-text outline-none"
          >
            <option value="">{tm("allCategories")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-market-muted" aria-hidden />
        </span>
      )}
      <button type="submit" className="inline-flex items-center bg-market-orange px-3 text-[12px] font-bold text-white transition-colors hover:bg-market-orange-dark sm:px-4" aria-label={t("searchLabel")}>
        <Search className="size-4 sm:hidden" aria-hidden />
        <span className="hidden sm:inline">{t("searchLabel")}</span>
      </button>
    </form>
  );
}
