import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StoreForm } from "@/components/seller/StoreForm";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sellerArea.onboarding" });
  return { title: t("title"), robots: { index: false } };
}

export default async function OnboardingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("sellerArea.onboarding");
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl sm:text-4xl">{t("title")}</h1>
      <p className="mb-6 mt-2 text-sm text-foreground-secondary">{t("subtitle")}</p>
      <StoreForm mode="create" />
    </div>
  );
}
