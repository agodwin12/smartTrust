import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAllCategories } from "@/features/catalog/api";
import { ListingEditor } from "@/components/seller/ListingEditor";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sellerArea.listingForm" });
  return { title: t("editTitle"), robots: { index: false } };
}

export default async function EditListingPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const categories = await getAllCategories();
  return <ListingEditor id={id} categories={categories} />;
}
