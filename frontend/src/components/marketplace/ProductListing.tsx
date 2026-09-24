import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ProductGrid } from "@/components/marketplace/ProductGrid";
import type { Paginated, Product } from "@/types";

type ProductListingProps = {
  result: Paginated<Product>;
  basePath: string;
  /** Query params to preserve across pagination links. */
  params?: Record<string, string | undefined>;
  emptyAction?: { label: string; href: string };
  priorityCount?: number;
};

/** Grid + pagination + empty state for any listing page (category, deals, search, store…). */
export async function ProductListing({ result, basePath, params = {}, emptyAction, priorityCount = 4 }: ProductListingProps) {
  const t = await getTranslations("catalog");

  if (result.items.length === 0) {
    return (
      <EmptyState
        title={t("empty.title")}
        description={t("empty.description")}
        action={emptyAction ?? { label: t("empty.action"), href: "/products" }}
      />
    );
  }

  return (
    <>
      <ProductGrid products={result.items} priorityCount={priorityCount} />
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath={basePath} params={params} />
    </>
  );
}
