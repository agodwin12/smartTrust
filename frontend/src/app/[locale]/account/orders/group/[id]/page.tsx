import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckoutGroupView } from "@/components/orders/CheckoutGroupView";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "orders.group" });
  return { title: t("title"), robots: { index: false } };
}

export default async function CheckoutGroupPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <CheckoutGroupView mode="account" groupId={id} />;
}
