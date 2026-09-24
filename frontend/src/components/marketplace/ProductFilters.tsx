"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { SORTS } from "@/features/catalog/api";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type ProductFiltersProps = {
  total: number;
  showLocation?: boolean;
  className?: string;
};

const FILTER_KEYS = ["condition", "minPrice", "maxPrice", "location"] as const;

/**
 * Sort + filter toolbar driven entirely by the URL (?sort=&condition=&minPrice=&maxPrice=&location=),
 * so results are shareable, crawlable and rendered on the server. Changing a filter resets to page 1.
 */
export function ProductFilters({ total, showLocation = true, className }: ProductFiltersProps) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const current = {
    sort: searchParams.get("sort") ?? "newest",
    condition: searchParams.get("condition") ?? "",
    minPrice: searchParams.get("minPrice") ?? "",
    maxPrice: searchParams.get("maxPrice") ?? "",
    location: searchParams.get("location") ?? "",
  };
  const activeCount = FILTER_KEYS.filter((key) => current[key]).length;

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  const onApply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    update({
      minPrice: String(form.get("minPrice") ?? "").trim(),
      maxPrice: String(form.get("maxPrice") ?? "").trim(),
      location: String(form.get("location") ?? "").trim(),
    });
    setOpen(false);
  };

  const clearAll = () => {
    update({ condition: undefined, minPrice: undefined, maxPrice: undefined, location: undefined });
    setOpen(false);
  };

  const chip = "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors";
  const chipIdle = "border-border bg-surface text-foreground-secondary hover:border-brand-blue hover:text-brand-blue";
  const chipActive = "border-brand-blue bg-brand-blue text-white";
  const input =
    "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-foreground-muted focus:border-brand-blue focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand-blue)_18%,transparent)]";

  return (
    <div className={cn("space-y-4", isPending && "opacity-70", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground-secondary">
          <span className="font-semibold text-foreground">{t("results", { count: total })}</span>
          {activeCount > 0 && <span className="ml-2 text-xs text-foreground-muted">· {t("filters.activeCount", { count: activeCount })}</span>}
        </p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-foreground-secondary">
            <span className="hidden sm:inline">{t("sort.label")}</span>
            <select
              value={current.sort}
              onChange={(e) => update({ sort: e.target.value === "newest" ? undefined : e.target.value })}
              className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-foreground outline-none focus:border-brand-blue"
            >
              {SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {t(`sort.${sort}`)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors lg:hidden",
              open || activeCount > 0 ? "border-brand-blue text-brand-blue" : "border-border text-foreground-secondary hover:text-foreground"
            )}
          >
            <SlidersHorizontal className="size-4" />
            {t("filters.title")}
          </button>
        </div>
      </div>

      {/* Filter panel — collapsible on phones, always visible from lg */}
      <form onSubmit={onApply} className={cn("rounded-2xl border border-border bg-surface p-4 lg:block", open ? "block" : "hidden")}>
        <div className="grid gap-4 lg:grid-cols-[auto_1fr_1fr_auto] lg:items-end">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-muted">{t("filters.condition")}</legend>
            <div className="flex gap-2">
              {[
                { value: "", label: t("filters.any") },
                { value: "NEW", label: t("filters.new") },
                { value: "USED", label: t("filters.used") },
              ].map((option) => (
                <button
                  key={option.value || "any"}
                  type="button"
                  onClick={() => update({ condition: option.value || undefined })}
                  aria-pressed={current.condition === option.value}
                  className={cn(chip, current.condition === option.value ? chipActive : chipIdle)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-muted">{t("filters.price")}</p>
            <div className="flex items-center gap-2">
              <input name="minPrice" type="number" min={0} inputMode="numeric" defaultValue={current.minPrice} placeholder={t("filters.min")} className={input} />
              <span className="text-foreground-muted">–</span>
              <input name="maxPrice" type="number" min={0} inputMode="numeric" defaultValue={current.maxPrice} placeholder={t("filters.max")} className={input} />
            </div>
          </div>

          {showLocation ? (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground-muted" htmlFor="filter-location">
                {t("filters.location")}
              </label>
              <input id="filter-location" name="location" defaultValue={current.location} placeholder={t("filters.locationPlaceholder")} className={input} />
            </div>
          ) : (
            <div className="hidden lg:block" />
          )}

          <div className="flex gap-2">
            <button type="submit" className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-light lg:flex-none">
              {t("filters.apply")}
            </button>
            {activeCount > 0 && (
              <button type="button" onClick={clearAll} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium text-foreground-secondary transition-colors hover:text-foreground">
                <X className="size-4" /> {t("filters.clear")}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
