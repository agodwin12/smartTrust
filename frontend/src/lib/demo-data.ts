/*
 * Decorative photography only (no fake products, stores or categories): pictures for
 * categories that have no image of their own and the generic hero-banner photos.
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


export const HERO_IMAGES = {
  main: unsplash("photo-1505740420928-5e560c06d30e", 1200),
  secondary: unsplash("photo-1523275335684-37898b6baf30", 600),
  seller: unsplash("photo-1556740738-b6a63e27c4df", 1200),
  deals: unsplash("photo-1607083206968-13611e3d76db", 1200),
  escrow: unsplash("photo-1556742049-0cfed4f6a45d", 1200),
};
