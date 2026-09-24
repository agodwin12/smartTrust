import type { Category, Product, Store } from "@/types";

/*
 * Editorial placeholder content used only when the API returns fewer items than a
 * homepage section needs (fresh database, backend offline). Everything here is
 * clearly namespaced with "demo-" ids so it can never be confused with real rows.
 * Photography: Unsplash (licence-free), sized through next/image.
 */

const unsplash = (id: string, w = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

/** Category slug → photo, so real categories without an upload still get an image. */
export const CATEGORY_IMAGES: Record<string, string> = {
  electronics: unsplash("photo-1498049794561-7780e7231661"),
  fashion: unsplash("photo-1445205170230-053b83016050"),
  "home-living": unsplash("photo-1556228453-efd6c1ff04f6"),
  "beauty-health": unsplash("photo-1596462502278-27bfdc403348"),
  sports: unsplash("photo-1517836357463-d25dfeac3438"),
  automotive: unsplash("photo-1492144534655-ae79c964c9d7"),
  "phones-tablets": unsplash("photo-1511707171634-5f897ff02aa9"),
  "kids-toys": unsplash("photo-1515488042361-ee00e0ddd4e4"),
  groceries: unsplash("photo-1542838132-92c53300491e"),
};

export const DEMO_CATEGORIES: Category[] = [
  { id: "demo-cat-1", name: "Electronics", slug: "electronics", imageUrl: null, parentId: null, productCount: 1240 },
  { id: "demo-cat-2", name: "Fashion", slug: "fashion", imageUrl: null, parentId: null, productCount: 2310 },
  { id: "demo-cat-3", name: "Home & Living", slug: "home-living", imageUrl: null, parentId: null, productCount: 860 },
  { id: "demo-cat-4", name: "Beauty & Health", slug: "beauty-health", imageUrl: null, parentId: null, productCount: 540 },
  { id: "demo-cat-5", name: "Sports", slug: "sports", imageUrl: null, parentId: null, productCount: 390 },
  { id: "demo-cat-6", name: "Phones & Tablets", slug: "phones-tablets", imageUrl: null, parentId: null, productCount: 980 },
  { id: "demo-cat-7", name: "Automotive", slug: "automotive", imageUrl: null, parentId: null, productCount: 215 },
  { id: "demo-cat-8", name: "Kids & Toys", slug: "kids-toys", imageUrl: null, parentId: null, productCount: 310 },
];

const demoStore = (id: string, name: string, slug: string, extra: Partial<Store> = {}): Store => ({
  id,
  ownerId: "demo",
  name,
  slug,
  description: null,
  logoUrl: null,
  bannerUrl: null,
  location: "Douala",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  verified: true,
  rating: 4.8,
  productCount: 120,
  ...extra,
});

export const DEMO_STORES: Store[] = [
  demoStore("demo-store-1", "Tech Elite", "tech-elite", { categoryName: "Electronics", rating: 4.8, productCount: 312, location: "Douala" }),
  demoStore("demo-store-2", "Style Avenue", "style-avenue", { categoryName: "Fashion", rating: 4.8, productCount: 540, location: "Yaoundé" }),
  demoStore("demo-store-3", "Home Gallery", "home-gallery", { categoryName: "Home & Living", rating: 4.7, productCount: 186, location: "Douala" }),
  demoStore("demo-store-4", "Luxury Finds", "luxury-finds", { categoryName: "Accessories", rating: 4.9, productCount: 97, location: "Bafoussam" }),
];

const demoProduct = (
  n: number,
  title: string,
  slug: string,
  price: number,
  image: string,
  store: Store,
  category: Category,
  extra: Partial<Product> = {}
): Product => ({
  id: `demo-prod-${n}`,
  storeId: store.id,
  categoryId: category.id,
  title,
  slug,
  description: null,
  price: String(price),
  condition: "NEW",
  location: store.location,
  images: [unsplash(image)],
  status: "PUBLISHED",
  viewCount: 0,
  featuredAt: null,
  featuredUntil: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  store: { id: store.id, name: store.name, slug: store.slug },
  category,
  rating: 4.8,
  reviewCount: 120,
  ...extra,
});

const [electronics, fashion, home, beauty] = DEMO_CATEGORIES;
const [techElite, styleAvenue, homeGallery, luxuryFinds] = DEMO_STORES;

export const DEMO_PRODUCTS: Product[] = [
  demoProduct(1, "Sony WH-1000XM5 Headphones", "sony-wh-1000xm5", 55000, "photo-1505740420928-5e560c06d30e", techElite, electronics, { description: "Industry-leading noise cancelling, 30h battery.", rating: 4.8, reviewCount: 128, compareAtPrice: "68000" }),
  demoProduct(2, "Nike Air Max 270", "nike-air-max-270", 65000, "photo-1542291026-7eec264c27ff", styleAvenue, fashion, { description: "Original, sealed box. Sizes 40–45.", rating: 4.6, reviewCount: 39 }),
  demoProduct(3, "Daniel Wellington Classic Watch", "daniel-wellington-classic", 95000, "photo-1523275335684-37898b6baf30", luxuryFinds, fashion, { description: "40 mm, rose gold case, leather strap.", rating: 4.9, reviewCount: 91 }),
  demoProduct(4, "Leather Weekender Bag", "leather-weekender-bag", 85000, "photo-1548036328-c9fa89d128fa", luxuryFinds, fashion, { description: "Full-grain leather, hand stitched.", rating: 4.9, reviewCount: 54 }),
  demoProduct(5, "Canon EOS R50 Kit", "canon-eos-r50", 480000, "photo-1516035069371-29a1b244cc32", techElite, electronics, { description: "24 MP mirrorless with 18–45 mm lens.", rating: 4.7, reviewCount: 22 }),
  demoProduct(6, "Ray-Ban Aviator Classic", "ray-ban-aviator", 42000, "photo-1572635196237-14b3f281503f", luxuryFinds, fashion, { description: "Gold frame, green G-15 lenses.", rating: 4.5, reviewCount: 61, compareAtPrice: "49000" }),
  demoProduct(7, "Scandinavian Lounge Chair", "scandinavian-lounge-chair", 145000, "photo-1555041469-a586c61ea9bc", homeGallery, home, { description: "Solid oak frame, wool blend cushion.", rating: 4.8, reviewCount: 17 }),
  demoProduct(8, "Dior Sauvage Eau de Parfum", "dior-sauvage-edp", 78000, "photo-1541643600914-78b084683601", styleAvenue, beauty, { description: "100 ml, authentic with batch code.", rating: 4.9, reviewCount: 203 }),
];

export const HERO_IMAGES = {
  main: unsplash("photo-1505740420928-5e560c06d30e", 1200),
  secondary: unsplash("photo-1523275335684-37898b6baf30", 600),
  seller: unsplash("photo-1556740738-b6a63e27c4df", 1200),
  deals: unsplash("photo-1607083206968-13611e3d76db", 1200),
  escrow: unsplash("photo-1556742049-0cfed4f6a45d", 1200),
};
