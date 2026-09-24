import { DEMO_CATEGORIES, DEMO_PRODUCTS, DEMO_STORES, CATEGORY_IMAGES } from "@/lib/demo-data";
import { getAllCategories, getCurrentFlashCampaign, getHeroProducts, getRootCategories, getUpcomingFlashCampaign, listProducts, listStores } from "@/features/catalog/api";
import type { ShowcaseGroups } from "@/components/market/ProductShowcase";
import type { Category, FlashCampaign, Product, Store } from "@/types";

export type HomeData = {
  /** Root departments: sidebar, category strip and header select. */
  categories: Category[];
  /** Best-stocked sub-categories for the "Top categories" panel. */
  subcategories: Category[];
  /** Featured (paid) listings, used for the hero montage. */
  heroProducts: Product[];
  /** Listings with a compare-at price, most viewed first. */
  deals: Product[];
  newest: Product[];
  stores: Store[];
  /** Three rows of five for the showcase: most viewed, just listed, under 50,000 FCFA. */
  showcase: ShowcaseGroups;
  /** Back-office flash campaign running now / scheduled next (null when none). */
  flashCurrent: FlashCampaign | null;
  flashUpcoming: FlashCampaign | null;
};

const MIN = { categories: 12, subcategories: 6, deals: 6, newest: 4, stores: 4, row: 5 } as const;
const BUDGET_MAX = 50000;

const safe = async <T>(promise: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await promise;
  } catch {
    // Backend down or slow: the homepage must still render (demo content fills the gap).
    return fallback;
  }
};

/**
 * Real rows first, then editorial placeholders until the section has enough to look like a
 * marketplace. A placeholder whose slug or name already exists among the real rows is skipped
 * so a fresh database never shows "Electronics" twice.
 */
function topUp<T extends { id: string; slug: string }>(real: T[], demo: T[], min: number): T[] {
  if (real.length >= min) return real.slice(0, min);
  const label = (item: T) => (("title" in item ? item.title : "name" in item ? item.name : "") as string).trim().toLowerCase();
  const taken = new Set(real.flatMap((item) => [item.slug, label(item)]));
  const fillers = demo.filter((item) => !taken.has(item.slug) && !taken.has(label(item)));
  return [...real, ...fillers.slice(0, min - real.length)];
}

const withCategoryImage = (category: Category): Category => ({
  ...category,
  imageUrl: category.imageUrl ?? CATEGORY_IMAGES[category.slug] ?? null,
});

const byCount = (a: Category, b: Category) => (b.productCount ?? 0) - (a.productCount ?? 0);

/** Five per row, never the same listing twice across the rows (or the "Newest" panel). */
function showcaseRows(popular: Product[], latest: Product[], budget: Product[], skip: Product[]): ShowcaseGroups {
  const seen = new Set(skip.map((p) => p.id));
  const take = (source: Product[]) => {
    const row = topUp(
      source.filter((p) => !seen.has(p.id)),
      DEMO_PRODUCTS.filter((p) => !seen.has(p.id)),
      MIN.row
    );
    row.forEach((p) => seen.add(p.id));
    return row;
  };
  return { popular: take(popular), latest: take(latest), budget: take(budget) };
}

export async function getHomeData(): Promise<HomeData> {
  const [categories, all, hero, deals, newest, stores, popular, latest, budget, flashCurrent, flashUpcoming] = await Promise.all([
    safe(getRootCategories(), []),
    safe(getAllCategories(), []),
    safe(getHeroProducts(undefined, 6), []),
    safe(listProducts({ deals: true, sort: "popular", pageSize: MIN.deals }).then((r) => r.items), []),
    safe(listProducts({ sort: "newest", pageSize: MIN.newest }).then((r) => r.items), []),
    safe(listStores({ pageSize: MIN.stores }).then((r) => r.items), []),
    safe(listProducts({ sort: "popular", pageSize: 15 }).then((r) => r.items), []),
    safe(listProducts({ sort: "newest", pageSize: 12 }).then((r) => r.items), []),
    safe(listProducts({ sort: "popular", maxPrice: BUDGET_MAX, pageSize: 12 }).then((r) => r.items), []),
    getCurrentFlashCampaign(),
    getUpcomingFlashCampaign(),
  ]);

  const subcategories = all.filter((c) => c.parentId).sort(byCount);

  return {
    // Real departments are never mixed with placeholders; demo ones only cover an empty database.
    categories: (categories.length > 0 ? categories.slice(0, MIN.categories) : DEMO_CATEGORIES).map(withCategoryImage),
    subcategories: topUp(subcategories, DEMO_CATEGORIES, MIN.subcategories).map(withCategoryImage),
    heroProducts: hero,
    deals: topUp(
      deals,
      DEMO_PRODUCTS.filter((p) => p.compareAtPrice),
      MIN.deals
    ),
    newest: topUp(newest, DEMO_PRODUCTS, MIN.newest),
    stores: topUp(stores, DEMO_STORES, MIN.stores),
    showcase: showcaseRows(popular, latest, budget, newest.slice(0, MIN.newest)),
    flashCurrent,
    flashUpcoming,
  };
}
