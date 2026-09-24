import type { MetadataRoute } from "next";
import { getAllCategories, listProducts, listStores } from "@/features/catalog/api";
import { routing } from "@/i18n/routing";
import { absoluteUrl, languageAlternates } from "@/lib/seo";

type Entry = MetadataRoute.Sitemap[number];
type Extra = Pick<Entry, "priority" | "changeFrequency" | "lastModified">;

const STATIC: { path: string; priority: number; changeFrequency: Entry["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/categories", priority: 0.9, changeFrequency: "daily" },
  { path: "/products", priority: 0.9, changeFrequency: "daily" },
  { path: "/deals", priority: 0.8, changeFrequency: "daily" },
  { path: "/new-arrivals", priority: 0.8, changeFrequency: "daily" },
  { path: "/stores", priority: 0.8, changeFrequency: "daily" },
  { path: "/sell", priority: 0.7, changeFrequency: "monthly" },
  { path: "/subscriptions", priority: 0.7, changeFrequency: "monthly" },
  { path: "/seller-guide", priority: 0.6, changeFrequency: "monthly" },
  { path: "/how-it-works", priority: 0.7, changeFrequency: "monthly" },
  { path: "/help/faq", priority: 0.5, changeFrequency: "monthly" },
  { path: "/help/returns", priority: 0.5, changeFrequency: "monthly" },
  { path: "/help/contact", priority: 0.4, changeFrequency: "yearly" },
  { path: "/about", priority: 0.4, changeFrequency: "yearly" },
  { path: "/legal/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/legal/privacy", priority: 0.2, changeFrequency: "yearly" },
];

const PAGE = 100;
const MAX_PAGES = 50; // 5,000 URLs per collection; switch to generateSitemaps() beyond that

/** One entry per locale, each carrying the full hreflang set. */
function entries(path: string, extra: Extra): Entry[] {
  return routing.locales.map((locale) => ({
    url: absoluteUrl(locale, path),
    alternates: { languages: languageAlternates(path) },
    ...extra,
  }));
}

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const out: Entry[] = STATIC.flatMap((s) => entries(s.path, { priority: s.priority, changeFrequency: s.changeFrequency }));

  // Each collection is best-effort: an API hiccup must not turn the sitemap into a 500.
  try {
    const categories = await getAllCategories();
    out.push(...categories.flatMap((c) => entries(`/categories/${c.slug}`, { priority: 0.7, changeFrequency: "daily" })));
  } catch {
    /* static entries only */
  }

  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await listProducts({ page, pageSize: PAGE, sort: "newest" });
      out.push(...result.items.flatMap((p) => entries(`/products/${p.slug}`, { priority: 0.8, changeFrequency: "weekly", lastModified: new Date(p.createdAt) })));
      if (page * PAGE >= result.total || result.items.length === 0) break;
    }
  } catch {
    /* see above */
  }

  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await listStores({ page, pageSize: PAGE });
      out.push(...result.items.flatMap((s) => entries(`/stores/${s.slug}`, { priority: 0.6, changeFrequency: "weekly" })));
      if (page * PAGE >= result.total || result.items.length === 0) break;
    }
  } catch {
    /* see above */
  }

  return out;
}
