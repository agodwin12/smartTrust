import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getProduct } from "@/features/catalog/api";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { PageShell } from "@/components/layout/PageShell";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return seo(locale, "/checkout", { title: t("title"), robots: { index: false } }, { noIndex: true });
}

export default async function CheckoutPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const product = await getProduct(slug);
  if (!product) notFound();

  return (
    <PageShell>
      <Suspense fallback={null}>
        <CheckoutFlow product={product} />
      </Suspense>
    </PageShell>
  );
}
