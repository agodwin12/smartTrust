import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getProduct } from "@/features/catalog/api";
import { CartCheckoutFlow } from "@/components/checkout/CartCheckoutFlow";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { PageShell } from "@/components/layout/PageShell";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ qty?: string; order?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return seo(locale, "/checkout", { title: t("title"), robots: { index: false } }, { noIndex: true });
}

/**
 * "Buy now" for one listing. Members and guests go through the same flow as the cart
 * (one reference, guest form when signed out). `?order=<id>` is the legacy link used to
 * resume payment of an order created before cart checkout existed; it stays members-only.
 */
export default async function CheckoutPage({ params, searchParams }: Props) {
  const [{ locale, slug }, { qty, order }] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const product = await getProduct(slug);
  if (!product) notFound();
  const quantity = Math.min(99, Math.max(1, Number(qty) || 1));

  return (
    <PageShell>
      <Suspense fallback={null}>{order ? <CheckoutFlow product={product} /> : <CartCheckoutFlow product={product} quantity={quantity} />}</Suspense>
    </PageShell>
  );
}
