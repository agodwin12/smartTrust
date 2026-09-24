"use client";

import { ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------------- */
/* Page header                                                                */
/* ------------------------------------------------------------------------- */

export function AdminHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-foreground-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Status pill — one colour language for every entity                        */
/* ------------------------------------------------------------------------- */

type Tone = "success" | "warning" | "danger" | "muted" | "info";

const TONES: Record<Tone, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/10 text-danger",
  muted: "bg-foreground-muted/15 text-foreground-secondary",
  info: "bg-brand-blue/10 text-brand-blue dark:text-brand-blue-light",
};

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "success",
  PUBLISHED: "success",
  COMPLETED: "success",
  RESOLVED: "success",
  RELEASED: "success",
  PENDING: "warning",
  PENDING_PAYMENT: "warning",
  CONFIRMED: "info",
  OPEN: "warning",
  IN_REVIEW: "info",
  PROCESSING: "info",
  PAID: "info",
  HELD: "info",
  DRAFT: "muted",
  SUSPENDED: "danger",
  BANNED: "danger",
  DISPUTED: "danger",
  FAILED: "danger",
  REJECTED: "danger",
  ARCHIVED: "muted",
  CANCELLED: "muted",
  REFUNDED: "muted",
  EXPIRED: "muted",
};

export function StatusPill({ status, label, tone, className }: { status?: string; label: ReactNode; tone?: Tone; className?: string }) {
  const resolved = tone ?? (status ? STATUS_TONE[status] : undefined) ?? "muted";
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[resolved], className)}>{label}</span>;
}

/* ------------------------------------------------------------------------- */
/* Toolbar controls                                                           */
/* ------------------------------------------------------------------------- */

export const adminField =
  "h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-foreground-muted focus:border-brand-blue focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand-blue)_18%,transparent)] disabled:opacity-60";

export const adminButton =
  "inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
export const adminPrimary = cn(adminButton, "bg-brand-blue text-white hover:bg-brand-blue-light");
export const adminSecondary = cn(adminButton, "border border-border bg-surface text-foreground hover:border-brand-blue hover:text-brand-blue");
export const adminDanger = cn(adminButton, "border border-danger/40 bg-danger/5 text-danger hover:bg-danger/10");
export const adminSuccess = cn(adminButton, "bg-success text-white hover:opacity-90");
/** Compact row action. */
export const rowAction =
  "inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-brand-blue hover:text-brand-blue disabled:opacity-60";

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>{children}</div>;
}

/** Debounced search input — fires `onChange` 350 ms after the user stops typing. */
export function SearchField({ value, onChange, placeholder, className }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  const t = useTranslations("admin.common");
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (draft === value) return;
    const id = setTimeout(() => onChange(draft.trim()), 350);
    return () => clearTimeout(id);
  }, [draft, value, onChange]);

  return (
    <label className={cn("relative block sm:w-72", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-muted" />
      <input type="search" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder ?? t("search")} className={cn(adminField, "w-full pl-9 pr-8")} />
      {draft && (
        <button type="button" onClick={() => setDraft("")} aria-label={t("cancel")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-foreground-muted hover:text-foreground">
          <X className="size-3.5" />
        </button>
      )}
    </label>
  );
}

export function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  allLabel,
  ariaLabel,
  className,
}: {
  value: T | "";
  onChange: (value: T | "") => void;
  options: { value: T; label: string }[];
  allLabel?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const t = useTranslations("admin.common");
  return (
    <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value as T | "")} className={cn(adminField, "sm:w-auto", className)}>
      <option value="">{allLabel ?? t("all")}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------------- */
/* Client pagination (lists are fetched client-side with the access token)   */
/* ------------------------------------------------------------------------- */

export function ClientPagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const t = useTranslations("common");
  const tc = useTranslations("admin.common");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const base = "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-border px-2.5 text-sm font-medium transition-colors disabled:opacity-40 enabled:hover:border-brand-blue enabled:hover:text-brand-blue";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-foreground-muted">
      <span>{tc("results", { count: total })}</span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <button type="button" className={base} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={t("previous")}>
            <ChevronLeft className="size-4" />
          </button>
          <span className="px-1 text-foreground-secondary">{t("page", { page, total: totalPages })}</span>
          <button type="button" className={base} disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label={t("next")}>
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Responsive table: real <table> from md up, stacked cards below            */
/* ------------------------------------------------------------------------- */

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Extra classes for the <td> (alignment, width, nowrap). */
  className?: string;
  /** Hide this column in the stacked mobile card (e.g. when it's already the card title). */
  hideOnMobile?: boolean;
  /** Render as the card title on mobile. */
  primary?: boolean;
};

export function AdminTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  empty,
  footer,
}: {
  columns: Column<T>[];
  rows: T[] | null;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  empty: ReactNode;
  footer?: ReactNode;
}) {
  const primary = columns.find((c) => c.primary);
  const rest = columns.filter((c) => c !== primary && !c.hideOnMobile);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      {error ? (
        <p className="p-6 text-sm text-danger">{error}</p>
      ) : rows === null ? (
        <div className="space-y-px p-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-hover" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-foreground-muted">{empty}</div>
      ) : (
        <>
          <div className={cn("relative", loading && "opacity-60")}>
            {loading && <Loader2 className="absolute right-3 top-3 z-10 size-4 animate-spin text-brand-blue" />}
            {/* Desktop */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-hover/60 text-xs uppercase tracking-wide text-foreground-muted">
                  <tr>
                    {columns.map((c) => (
                      <th key={c.key} scope="col" className={cn("px-4 py-3 font-semibold", c.className)}>
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={rowKey(row)} className="align-middle transition-colors hover:bg-surface-hover/50">
                      {columns.map((c) => (
                        <td key={c.key} className={cn("px-4 py-3", c.className)}>
                          {c.cell(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <ul className="divide-y divide-border md:hidden">
              {rows.map((row) => (
                <li key={rowKey(row)} className="space-y-2 p-4">
                  {primary && <div className="text-sm font-semibold text-foreground">{primary.cell(row)}</div>}
                  <dl className="grid grid-cols-[minmax(0,40%)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                    {rest.map((c) => (
                      <div key={c.key} className="contents">
                        <dt className="text-xs uppercase tracking-wide text-foreground-muted">{c.header}</dt>
                        <dd className="min-w-0 text-foreground [&_a]:break-words">{c.cell(row)}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          </div>
          {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
        </>
      )}
      {rows !== null && rows.length === 0 && !error && footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Form helpers                                                               */
/* ------------------------------------------------------------------------- */

export function Field({ label, children, hint, className }: { label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="block text-xs text-foreground-muted">{hint}</span>}
    </label>
  );
}

export function Checkbox({ label, checked, onChange, name }: { label: ReactNode; checked: boolean; onChange: (checked: boolean) => void; name?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 rounded border-border accent-[var(--brand-blue)]" />
      {label}
    </label>
  );
}

/** Small identifier chip (order/user ids). */
export function IdChip({ id }: { id: string }) {
  return <code className="rounded-md bg-surface-hover px-1.5 py-0.5 font-mono text-[11px] text-foreground-secondary">{id.slice(-8).toUpperCase()}</code>;
}

/** Stat card used on the dashboard. */
export function StatCard({ icon, label, value, href, tone = "info" }: { icon: ReactNode; label: string; value: ReactNode; href?: string; tone?: Tone }) {
  const body = (
    <>
      <span className={cn("inline-flex size-10 items-center justify-center rounded-xl", TONES[tone])}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-foreground-muted">{label}</p>
        <p className="mt-0.5 truncate text-2xl font-semibold text-foreground">{value ?? <span className="inline-block h-7 w-16 animate-pulse rounded-md bg-surface-hover align-middle" />}</p>
      </div>
    </>
  );
  const className = "flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors";
  return href ? (
    <Link href={href} className={cn(className, "hover:border-brand-blue")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
