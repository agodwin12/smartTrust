"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import type { SellerDashboard } from "@/types";
import { StoreForm } from "@/components/seller/StoreForm";

/** Loads the seller's store and hands it to the edit form. */
export function StoreSettings() {
  const t = useTranslations("sellerArea.nav");
  const { authFetch } = useAuth();
  const [store, setStore] = useState<SellerDashboard | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch<{ store: SellerDashboard }>("stores/me").then(({ store }) => !cancelled && setStore(store)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">{t("store")}</h1>
      {store ? <StoreForm mode="edit" initial={store} /> : <div className="h-96 animate-pulse rounded-3xl bg-surface-hover" />}
    </div>
  );
}
