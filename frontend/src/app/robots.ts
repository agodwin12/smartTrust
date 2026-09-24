import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo";

// Pages that are personal, transactional or duplicate content — never worth indexing.
const PRIVATE = ["/account", "/seller", "/admin", "/cart", "/checkout", "/wishlist", "/login", "/register", "/verify-email", "/forgot-password", "/reset-password", "/auth", "/orders", "/search"];

export default function robots(): MetadataRoute.Robots {
  const disallow = PRIVATE.flatMap((path) => routing.locales.map((locale) => (locale === routing.defaultLocale ? path : `/${locale}${path}`)));
  return {
    rules: [{ userAgent: "*", allow: "/", disallow }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
