import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  /** Path without query, e.g. "/products". */
  basePath: string;
  /** Current query params to preserve (page is overwritten). */
  params?: Record<string, string | undefined>;
  className?: string;
};

export function pageHref(basePath: string, params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  if (page > 1) search.set("page", String(page));
  else search.delete("page");
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Server component — plain links, so pagination works without JavaScript and is crawlable. */
export async function Pagination({ page, pageSize, total, basePath, params = {}, className }: PaginationProps) {
  const t = await getTranslations("common");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages: (number | "gap")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 2) pages.push(p);
    else if (pages[pages.length - 1] !== "gap") pages.push("gap");
  }

  const base = "inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-border px-3 text-sm font-medium transition-colors";
  const active = "hover:border-brand-blue hover:text-brand-blue";

  return (
    <nav aria-label="Pagination" className={cn("mt-10 flex flex-col items-center gap-3", className)}>
      <p className="text-xs text-foreground-muted">{t("page", { page, total: totalPages })}</p>
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          {page > 1 ? (
            <Link href={pageHref(basePath, params, page - 1)} className={cn(base, active)} aria-label={t("previous")}>
              <ChevronLeft className="size-4" />
            </Link>
          ) : (
            <span className={cn(base, "opacity-40")}>
              <ChevronLeft className="size-4" />
            </span>
          )}
        </li>
        {pages.map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} className="px-1 text-foreground-muted">
              …
            </li>
          ) : (
            <li key={p}>
              {p === page ? (
                <span className={cn(base, "border-brand-blue bg-brand-blue text-white")} aria-current="page">
                  {p}
                </span>
              ) : (
                <Link href={pageHref(basePath, params, p)} className={cn(base, active)}>
                  {p}
                </Link>
              )}
            </li>
          )
        )}
        <li>
          {page < totalPages ? (
            <Link href={pageHref(basePath, params, page + 1)} className={cn(base, active)} aria-label={t("next")}>
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span className={cn(base, "opacity-40")}>
              <ChevronRight className="size-4" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
