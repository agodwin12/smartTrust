"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import type { Category, Product } from "@/types";
import { ListingForm } from "@/components/seller/ListingForm";
import { EmptyState } from "@/components/ui/EmptyState";

/** Loads one of the seller's own listings (drafts included) and hands it to the form. */
export function ListingEditor({ id, categories }: { id: string; categories: Category[] }) {
  const t = useTranslations("sellerArea.listings");
  const { authFetch } = useAuth();
  const [listing, setListing] = useState<Product | null | "missing">(null);

  useEffect(() => {
    let cancelled = false;
    authFetch<{ advertisement: Product }>(`advertisements/me/${id}`)
      .then(({ advertisement }) => !cancelled && setListing(advertisement))
      .catch(() => !cancelled && setListing("missing"));
    return () => {
      cancelled = true;
    };
  }, [id, authFetch]);

  if (listing === null) return <div className="h-96 animate-pulse rounded-3xl bg-surface-hover" />;
  if (listing === "missing") return <EmptyState title={t("empty.title")} action={{ label: t("title"), href: "/seller/listings" }} />;
  return <ListingForm mode="edit" initial={listing} categories={categories} />;
}
