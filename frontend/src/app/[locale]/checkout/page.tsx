import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CartCheckoutFlow } from "@/components/checkout/CartCheckoutFlow";
import { PageShell } from "@/components/layout/PageShell";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout.cart" });
  return seo(locale, "/checkout", { title: t("title"), robots: { index: false } }, { noIndex: true });
}

/** Whole-cart checkout: one order reference, one payment, guests welcome. */
export default async function CartCheckoutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <PageShell>
      <Suspense fallback={null}>
        <CartCheckoutFlow />
      </Suspense>
    </PageShell>
  );
}
