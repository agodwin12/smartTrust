const CURRENCY = "XAF";

/** "XAF 120,000" (en) · "120 000 FCFA" (fr). Amounts arrive as decimal strings from the API. */
export function formatPrice(amount: string | number | null | undefined, locale: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatDate(value: string | Date, locale: string, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  return new Intl.DateTimeFormat(locale, options).format(typeof value === "string" ? new Date(value) : value);
}

/** Percentage saved between a compare-at price and the current price, or null when not a deal. */
export function discountPercent(price: string | number, compareAtPrice?: string | number | null): number | null {
  const p = Number(price);
  const c = compareAtPrice === null || compareAtPrice === undefined ? NaN : Number(compareAtPrice);
  if (!Number.isFinite(p) || !Number.isFinite(c) || c <= p) return null;
  return Math.round(((c - p) / c) * 100);
}

/** Two-letter initials for avatar fallbacks ("Testy Electronics Hub" → "TE"). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/** Only allow same-site relative paths for post-login redirects (never "//evil.com"). */
export function safeNextPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
