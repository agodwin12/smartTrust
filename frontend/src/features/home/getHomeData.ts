import { CATEGORY_IMAGES } from "@/lib/demo-data";
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
  /** Three rows of twelve for the showcase: most viewed, just listed, under 50,000 FCFA. */
  showcase: ShowcaseGroups;
  /** Back-office flash campaign running now / scheduled next (null when none). */
  flashCurrent: FlashCampaign | null;
  flashUpcoming: FlashCampaign | null;
};

const MIN = { categories: 12, subcategories: 6, deals: 12, newest: 12, stores: 4, row: 12 } as const;
const BUDGET_MAX = 50000;

const safe = async <T>(promise: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await promise;
  } catch {
    // Backend down or slow: the homepage still renders, with empty sections instead of errors.
    return fallback;
  }
};

const withCategoryImage = (category: Category): Category => ({
  ...category,
  imageUrl: category.imageUrl ?? CATEGORY_IMAGES[category.slug] ?? null,
});

const byCount = (a: Category, b: Category) => (b.productCount ?? 0) - (a.productCount ?? 0);

/** Up to twelve real listings per row, never the same listing twice across the rows (or the "Newest" panel). */
function showcaseRows(popular: Product[], latest: Product[], budget: Product[], skip: Product[]): ShowcaseGroups {
  const seen = new Set(skip.map((p) => p.id));
  const take = (source: Product[]) => {
    const row = source.filter((p) => !seen.has(p.id)).slice(0, MIN.row);
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
    safe(listProducts({ sort: "popular", pageSize: 40 }).then((r) => r.items), []),
    safe(listProducts({ sort: "newest", pageSize: 48 }).then((r) => r.items), []),
    safe(listProducts({ sort: "popular", maxPrice: BUDGET_MAX, pageSize: 40 }).then((r) => r.items), []),
    getCurrentFlashCampaign(),
    getUpcomingFlashCampaign(),
  ]);

  // Only real data: departments, the best-stocked sub-categories that have listings, real stores and listings.
  const subcategories = all.filter((c) => c.parentId && (c.productCount ?? 0) > 0).sort(byCount).slice(0, MIN.subcategories);
  // The hero shows three photos per slide: featured listings first, then popular ones.
  const heroIds = new Set(hero.map((p) => p.id));
  const heroProducts = [...hero, ...popular.filter((p) => p.images?.[0] && !heroIds.has(p.id))].slice(0, 12);

  return {
    categories: categories.slice(0, MIN.categories).map(withCategoryImage),
    subcategories: subcategories.map(withCategoryImage),
    heroProducts,
    deals: deals.slice(0, MIN.deals),
    newest: newest.slice(0, MIN.newest),
    stores: stores.slice(0, MIN.stores),
    showcase: showcaseRows(popular, latest, budget, newest),
    flashCurrent,
    flashUpcoming,
  };
}
