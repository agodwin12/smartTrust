"use client";

import { Store as StoreIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { ProductGrid } from "@/components/marketplace/ProductGrid";
import { StoreCard } from "@/components/marketplace/StoreCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Product, Store } from "@/types";

type SearchResultsProps = {
  query: string;
  products: Product[];
  productsTotal: number;
  stores: Store[];
  storesTotal: number;
};

export function SearchResults({ query, products, productsTotal, stores, storesTotal }: SearchResultsProps) {
  const t = useTranslations("search");
  const tc = useTranslations("catalog");

  if (productsTotal === 0 && storesTotal === 0) {
    return <EmptyState title={t("empty", { query })} action={{ label: tc("empty.action"), href: "/products" }} />;
  }

  return (
    <Tabs defaultValue={productsTotal > 0 ? "products" : "stores"}>
      <TabsList className="mb-6">
        <TabsTrigger value="products">{t("productsTab", { count: productsTotal })}</TabsTrigger>
        <TabsTrigger value="stores">{t("storesTab", { count: storesTotal })}</TabsTrigger>
      </TabsList>
      <TabsContent value="products">
        {products.length > 0 ? <ProductGrid products={products} /> : <EmptyState title={t("empty", { query })} />}
      </TabsContent>
      <TabsContent value="stores">
        {stores.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stores.map((store) => (
              <li key={store.id}>
                <StoreCard store={store} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={StoreIcon} title={t("empty", { query })} />
        )}
      </TabsContent>
    </Tabs>
  );
}
