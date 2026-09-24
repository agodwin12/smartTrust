import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAllCategories } from "@/features/catalog/api";
import { ListingForm } from "@/components/seller/ListingForm";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sellerArea.listingForm" });
  return { title: t("createTitle"), robots: { index: false } };
}

export default async function NewListingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const categories = await getAllCategories();
  return <ListingForm mode="create" categories={categories} />;
}
