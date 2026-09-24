import { apiFetch, isNotFound } from "@/lib/api";
import { CATEGORY_IMAGES } from "@/lib/demo-data";
import type { Category, Paginated, Product, Store, SubscriptionPlan } from "@/types";

/*
 * Server-side catalog fetchers. Public data only — cached with short revalidation
 * windows so the site stays fast under load while listings still feel live.
 */
const REVALIDATE = { categories: 60, products: 30, product: 30, stores: 60, plans: 300 } as const;

export const SORTS = ["newest", "price_asc", "price_desc", "popular"] as const;
export type ProductSort = (typeof SORTS)[number];

export type ProductQuery = {
  page?: number;
  pageSize?: number;
  categorySlug?: string;
  storeId?: string;
  search?: string;
  sort?: string;
  minPrice?: string | number;
  maxPrice?: string | number;
  condition?: string;
  location?: string;
  deals?: boolean;
};

/** Listings without an upload fall back to their category's photo so the grid never shows an empty tile. */
export function withProductImage(product: Product): Product {
  if (product.images && product.images.length > 0) return product;
  const fallback = CATEGORY_IMAGES[product.category?.slug ?? ""] ?? CATEGORY_IMAGES.electronics;
  return { ...product, images: [fallback] };
}

export async function listProducts(query: ProductQuery = {}): Promise<Paginated<Product>> {
  const data = await apiFetch<Paginated<Product>>("advertisements", {
    params: {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 24,
      categorySlug: query.categorySlug,
      storeId: query.storeId,
      search: query.search,
      sort: SORTS.includes(query.sort as ProductSort) ? query.sort : undefined,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      condition: query.condition,
      location: query.location,
      deals: query.deals ? "true" : undefined,
    },
    next: { revalidate: REVALIDATE.products },
  });
  return { ...data, items: data.items.map(withProductImage) };
}

export async function getProduct(slug: string): Promise<Product | null> {
  try {
    const { advertisement } = await apiFetch<{ advertisement: Product }>(`advertisements/${encodeURIComponent(slug)}`, {
      next: { revalidate: REVALIDATE.product },
    });
    return withProductImage(advertisement);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function getHeroProducts(categoryId?: string, limit = 6): Promise<Product[]> {
  try {
    const data = await apiFetch<{ items: Product[] }>("advertisements/hero", {
      params: { categoryId, limit },
      next: { revalidate: REVALIDATE.products },
    });
    return (data.items ?? []).map(withProductImage);
  } catch {
    return [];
  }
}

export async function getRootCategories(): Promise<Category[]> {
  const data = await apiFetch<Paginated<Category>>("categories", {
    params: { parentId: "root", withCounts: "true", pageSize: 100 },
    next: { revalidate: REVALIDATE.categories },
  });
  return data.items;
}

export async function getAllCategories(): Promise<Category[]> {
  const data = await apiFetch<Paginated<Category>>("categories", {
    params: { pageSize: 100, withCounts: "true" },
    next: { revalidate: REVALIDATE.categories },
  });
  return data.items;
}

export async function getCategory(slug: string): Promise<Category | null> {
  try {
    const { category } = await apiFetch<{ category: Category }>(`categories/${encodeURIComponent(slug)}`, {
      next: { revalidate: REVALIDATE.categories },
    });
    return category;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function listStores(query: { page?: number; pageSize?: number; search?: string } = {}): Promise<Paginated<Store>> {
  return apiFetch<Paginated<Store>>("stores", {
    params: { page: query.page ?? 1, pageSize: query.pageSize ?? 24, search: query.search },
    next: { revalidate: REVALIDATE.stores },
  });
}

export async function getStore(slug: string): Promise<Store | null> {
  try {
    const { store } = await apiFetch<{ store: Store }>(`stores/${encodeURIComponent(slug)}`, { next: { revalidate: REVALIDATE.stores } });
    return store;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function getPlans(): Promise<SubscriptionPlan[]> {
  try {
    const { plans } = await apiFetch<{ plans: SubscriptionPlan[] }>("subscription-plans", { next: { revalidate: REVALIDATE.plans } });
    return plans;
  } catch {
    return [];
  }
}
