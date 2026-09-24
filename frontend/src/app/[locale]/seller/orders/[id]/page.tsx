import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OrderDetail } from "@/components/orders/OrderDetail";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "orderDetail" });
  return { title: t("title", { id: id.slice(-8).toUpperCase() }), robots: { index: false } };
}

export default async function SellerOrderPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <OrderDetail orderId={id} perspective="seller" />;
}
