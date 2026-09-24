import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FlashDealsView } from "@/components/seller/FlashDealsView";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sellerArea" });
  return { title: t("nav.flashDeals"), robots: { index: false } };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FlashDealsView />;
}
