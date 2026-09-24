"use client";

import { ChevronDown, Clock, LayoutGrid, Loader2, Search, Store as StoreIcon, X } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useId, useMemo, useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import { useSearchSuggestions, type SuggestedCategory, type SuggestedProduct, type SuggestedStore } from "@/features/search/useSearchSuggestions";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { Link, useRouter } from "@/i18n/navigation";
import { formatPrice, initials } from "@/lib/format";
import { splitMatch } from "@/lib/highlight";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

type MarketSearchProps = {
  categories?: Category[];
  /** Show the "All categories" select (desktop header). */
  withCategory?: boolean;
  className?: string;
};

type Row =
  | { kind: "query"; key: string; href: string; label: string }
  | { kind: "recent"; key: string; href: string; label: string }
  | { kind: "product"; key: string; href: string; product: SuggestedProduct }
  | { kind: "category"; key: string; href: string; category: SuggestedCategory }
  | { kind: "store"; key: string; href: string; store: SuggestedStore };

const RECENT_KEY = "sm:recent-searches";
const RECENT_LIMIT = 5;
const NO_RECENT: string[] = [];

const searchHref = (q: string, category: string) => `/search?q=${encodeURIComponent(q)}${category ? `&category=${encodeURIComponent(category)}` : ""}`;

function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {splitMatch(text, query).map((part, i) =>
        part.match ? (
          <mark key={i} className="bg-transparent font-bold text-market-ink">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

/**
 * Header search (design guide §8) with instant suggestions: products, categories and stores
 * appear while typing (debounced, cached), recent searches show on focus, arrow keys + Enter
 * pick a row, Escape closes. Submitting always goes to the full results page.
 */
export function MarketSearch({ categories = [], withCategory = false, className }: MarketSearchProps) {
  const t = useTranslations("nav");
  const tm = useTranslations("market.header");
  const ts = useTranslations("market.search");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const listId = `${id}-listbox`;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useLocalStorageState<string[]>(RECENT_KEY, NO_RECENT);
  const formRef = useRef<HTMLFormElement>(null);

  const { suggestions, loading, active, query: q } = useSearchSuggestions(query, open);

  const remember = useCallback(
    (term: string) => setRecent((prev) => [term, ...prev.filter((p) => p.toLowerCase() !== term.toLowerCase())].slice(0, RECENT_LIMIT)),
    [setRecent]
  );

  const rows = useMemo<Row[]>(() => {
    if (!active) {
      return query.trim() ? [] : recent.map((term) => ({ kind: "recent", key: `recent:${term}`, href: searchHref(term, category), label: term }));
    }
    return [
      { kind: "query", key: "query", href: searchHref(q, category), label: q },
      ...suggestions.products.map((product) => ({ kind: "product" as const, key: `p:${product.id}`, href: `/products/${product.slug}`, product })),
      ...suggestions.categories.map((c) => ({ kind: "category" as const, key: `c:${c.id}`, href: `/categories/${c.slug}`, category: c })),
      ...suggestions.stores.map((store) => ({ kind: "store" as const, key: `s:${store.id}`, href: `/stores/${store.slug}`, store })),
    ];
  }, [active, query, recent, category, q, suggestions]);

  const showPanel = open && (rows.length > 0 || (active && loading) || (active && !loading));
  const noResults = active && !loading && suggestions.products.length === 0 && suggestions.categories.length === 0 && suggestions.stores.length === 0;

  const go = (row: Row) => {
    if (row.kind === "query" || row.kind === "recent") remember(row.label);
    setOpen(false);
    router.push(row.href);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (activeIndex >= 0 && rows[activeIndex]) return go(rows[activeIndex]);
    const term = query.trim();
    if (term) {
      remember(term);
      setOpen(false);
      router.push(searchHref(term, category));
    } else if (category) {
      setOpen(false);
      router.push(`/categories/${category}`);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!rows.length) return;
      event.preventDefault();
      setOpen(true);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      // Cycle through -1 (the input itself) and every row.
      setActiveIndex((i) => {
        const next = i + delta;
        if (next >= rows.length) return -1;
        if (next < -1) return rows.length - 1;
        return next;
      });
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const onBlur = (event: FocusEvent<HTMLFormElement>) => {
    if (!formRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
  };

  const rowClass = (index: number) =>
    cn(
      "flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] text-market-text transition-colors hover:bg-market-blue-light",
      index === activeIndex && "bg-market-blue-light"
    );
  const groupTitle = "px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-market-muted";

  return (
    <form
      ref={formRef}
      role="search"
      onSubmit={onSubmit}
      onBlur={onBlur}
      className={cn("relative flex h-10 items-stretch rounded-[7px] bg-white text-market-ink shadow-[inset_0_0_0_1px_var(--market-border)] transition-shadow focus-within:shadow-[0_0_0_2px_var(--market-orange)] dark:bg-market-surface", className)}
    >
      <label htmlFor={id} className="sr-only">
        {t("searchLabel")}
      </label>
      <span className="flex items-center pl-3 text-market-muted">
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
      </span>
      <input
        id={id}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 && rows[activeIndex] ? `${listId}-${rows[activeIndex].key}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(-1);
          setOpen(true);
        }}
        onFocus={() => {
          setActiveIndex(-1);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={t("searchPlaceholder")}
        autoComplete="off"
        className="h-full min-w-0 flex-1 rounded-l-[7px] bg-transparent px-2 text-[13px] text-market-ink outline-none placeholder:text-market-muted [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setOpen(true);
          }}
          aria-label={ts("clear")}
          className="flex items-center px-1.5 text-market-muted hover:text-market-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
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
      <button type="submit" className="inline-flex items-center rounded-r-[7px] bg-market-orange px-3 text-[12px] font-bold text-white transition-colors hover:bg-market-orange-dark sm:px-4" aria-label={t("searchLabel")}>
        <Search className="size-4 sm:hidden" aria-hidden />
        <span className="hidden sm:inline">{t("searchLabel")}</span>
      </button>

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          aria-label={ts("suggestions")}
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[70vh] overflow-y-auto overscroll-contain rounded-[8px] border border-market-border bg-market-surface py-1 font-market shadow-market-hover"
        >
          {!active && rows.length > 0 && (
            <div className="flex items-center justify-between">
              <p className={groupTitle}>{ts("recent")}</p>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setRecent([])} className="market-link px-3 text-[10px]">
                {ts("clear")}
              </button>
            </div>
          )}

          {rows.map((row, index) => {
            const common = {
              id: `${listId}-${row.key}`,
              role: "option" as const,
              "aria-selected": index === activeIndex,
              tabIndex: -1,
              onMouseDown: (e: MouseEvent) => e.preventDefault(),
              onMouseEnter: () => setActiveIndex(index),
              onClick: (e: MouseEvent) => {
                e.preventDefault();
                go(row);
              },
            };
            const heading =
              (row.kind === "product" && index > 0 && rows[index - 1].kind !== "product" && <p className={groupTitle}>{ts("products")}</p>) ||
              (row.kind === "category" && rows[index - 1]?.kind !== "category" && <p className={groupTitle}>{ts("categories")}</p>) ||
              (row.kind === "store" && rows[index - 1]?.kind !== "store" && <p className={groupTitle}>{ts("stores")}</p>) ||
              null;

            return (
              <div key={row.key}>
                {heading}
                {row.kind === "query" || row.kind === "recent" ? (
                  <Link href={row.href} {...common} className={rowClass(index)}>
                    {row.kind === "recent" ? <Clock className="size-4 shrink-0 text-market-muted" aria-hidden /> : <Search className="size-4 shrink-0 text-market-blue" aria-hidden />}
                    <span className="truncate">{row.kind === "recent" ? row.label : ts("searchFor", { query: row.label })}</span>
                  </Link>
                ) : row.kind === "product" ? (
                  <Link href={row.href} {...common} className={rowClass(index)}>
                    <span className="relative size-9 shrink-0 overflow-hidden rounded-[6px] bg-market-blue-light">
                      {row.product.image && <Image src={row.product.image} alt="" fill sizes="36px" className="object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        <Highlight text={row.product.title} query={q} />
                      </span>
                      {row.product.category && <span className="block truncate text-[11px] text-market-muted">{row.product.category.name}</span>}
                    </span>
                    <span className="shrink-0 text-[12px] font-extrabold text-market-ink">{formatPrice(row.product.price, locale)}</span>
                  </Link>
                ) : row.kind === "category" ? (
                  <Link href={row.href} {...common} className={rowClass(index)}>
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[6px] bg-market-blue-light text-market-blue">
                      <LayoutGrid className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <Highlight text={row.category.name} query={q} />
                      {row.category.parent && <span className="ml-1 text-[11px] text-market-muted">{" "}{ts("inParent", { parent: row.category.parent.name })}</span>}
                    </span>
                  </Link>
                ) : (
                  <Link href={row.href} {...common} className={rowClass(index)}>
                    <span className="relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-market-navy text-[11px] font-bold text-white">
                      {row.store.logoUrl ? <Image src={row.store.logoUrl} alt="" fill sizes="36px" className="object-cover" /> : initials(row.store.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        <StoreIcon className="mr-1 inline size-3.5 text-market-muted" aria-hidden />
                        <Highlight text={row.store.name} query={q} />
                      </span>
                      {row.store.location && <span className="block truncate text-[11px] text-market-muted">{row.store.location}</span>}
                    </span>
                  </Link>
                )}
              </div>
            );
          })}

          {active && loading && rows.length <= 1 && <p className="px-3 py-2 text-[12px] text-market-muted">{ts("loading")}</p>}
          {noResults && <p className="px-3 py-2 text-[12px] text-market-muted">{ts("noResults", { query: q })}</p>}
        </div>
      )}
    </form>
  );
}
