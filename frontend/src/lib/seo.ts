import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

/** Public origin of the site (no trailing slash). Set NEXT_PUBLIC_SITE_URL in production. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3020").replace(/\/$/, "");
export const SITE_NAME = "SmartPlaze";

/** "/products/x" → "/products/x" for the default locale, "/fr/products/x" for French. */
export function localizedPath(locale: string, path: string): string {
  const clean = path === "/" ? "" : path.replace(/\/$/, "");
  return locale === routing.defaultLocale ? clean || "/" : `/${locale}${clean}`;
}

export const absoluteUrl = (locale: string, path: string) => `${SITE_URL}${localizedPath(locale, path)}`;

/** hreflang map for one path: every locale plus x-default (the default-locale URL). */
export function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) languages[locale] = absoluteUrl(locale, path);
  languages["x-default"] = absoluteUrl(routing.defaultLocale, path);
  return languages;
}

type SeoOptions = {
  /** Open Graph / Twitter image URLs (absolute). */
  images?: string[];
  /** Hide from search engines (private or duplicate pages). */
  noIndex?: boolean;
};

/**
 * Completes a page's own title/description with what every indexable page needs:
 * canonical URL, hreflang alternates (EN/FR + x-default), Open Graph and Twitter cards.
 * `path` is the locale-less route ("/categories/phones"); query strings are never part
 * of the canonical, so paginated/filtered views all point at the base page.
 */
export function seo(locale: string, path: string, meta: Metadata = {}, options: SeoOptions = {}): Metadata {
  const url = absoluteUrl(locale, path);
  const title = typeof meta.title === "string" ? meta.title : undefined;
  const description = typeof meta.description === "string" ? meta.description : undefined;
  const images = options.images?.filter(Boolean);
  const robots = options.noIndex ? { index: false, follow: false } : meta.robots;

  return {
    ...meta,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: locale === "fr" ? "fr_FR" : "en_US",
      url,
      ...(title && { title }),
      ...(description && { description }),
      ...(images?.length && { images }),
    },
    twitter: {
      card: images?.length ? "summary_large_image" : "summary",
      ...(title && { title }),
      ...(description && { description }),
      ...(images?.length && { images }),
    },
    ...(robots && { robots }),
  };
}
