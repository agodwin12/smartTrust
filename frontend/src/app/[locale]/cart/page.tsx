import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CartView } from "@/components/cart/CartView";
import { PageShell } from "@/components/layout/PageShell";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cart" });
  return seo(locale, "/cart", { title: t("title"), robots: { index: false } }, { noIndex: true });
}

export default async function CartPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <PageShell>
      <CartView />
    </PageShell>
  );
}
