import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo";
import type { Product, Store } from "@/types";

type Json = Record<string, unknown>;

/** Renders schema.org structured data. `<` is escaped so user content can never break out of the script tag. */
export function JsonLd({ data }: { data: Json | Json[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

const CONDITION: Record<Product["condition"], string> = {
  NEW: "https://schema.org/NewCondition",
  USED: "https://schema.org/UsedCondition",
  REFURBISHED: "https://schema.org/RefurbishedCondition",
};

export function organizationJsonLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icons/icon-512.png`,
  };
}

export function websiteJsonLd(locale: string): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl(locale, "/"),
    inLanguage: locale,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl(locale, "/search")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(locale: string, items: { name: string; path?: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      ...(item.path && { item: absoluteUrl(locale, item.path) }),
    })),
  };
}

export function productJsonLd(product: Product, store: Store | null, locale: string): Json {
  const url = absoluteUrl(locale, `/products/${product.slug}`);
  const rating = store?.rating;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    ...(product.description && { description: product.description.slice(0, 500) }),
    ...(product.images?.length && { image: product.images }),
    sku: product.id,
    url,
    category: product.category?.name,
    itemCondition: CONDITION[product.condition] ?? CONDITION.USED,
    offers: {
      "@type": "Offer",
      url,
      price: Number(product.price),
      priceCurrency: "XAF",
      availability: product.status === "PUBLISHED" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: CONDITION[product.condition] ?? CONDITION.USED,
      seller: { "@type": "Organization", name: product.store.name, url: absoluteUrl(locale, `/stores/${product.store.slug}`) },
      ...(product.location && { areaServed: product.location }),
    },
    ...(typeof rating === "number" &&
      store?.reviewCount && {
        aggregateRating: { "@type": "AggregateRating", ratingValue: rating, reviewCount: store.reviewCount, bestRating: 5, worstRating: 1 },
      }),
  };
}

export function storeJsonLd(store: Store, locale: string): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: store.name,
    url: absoluteUrl(locale, `/stores/${store.slug}`),
    ...(store.description && { description: store.description.slice(0, 500) }),
    ...(store.logoUrl && { image: store.logoUrl, logo: store.logoUrl }),
    ...(store.location && { address: { "@type": "PostalAddress", addressLocality: store.location, addressCountry: "CM" } }),
    ...(store.contactPhone && { telephone: store.contactPhone }),
    ...(typeof store.rating === "number" &&
      store.reviewCount && {
        aggregateRating: { "@type": "AggregateRating", ratingValue: store.rating, reviewCount: store.reviewCount, bestRating: 5, worstRating: 1 },
      }),
    parentOrganization: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}
