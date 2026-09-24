import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DisputeDetail } from "@/components/admin/DisputeDetail";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: `${t("nav.disputes")} #${id.slice(-8).toUpperCase()} · ${t("title")}`, robots: { index: false } };
}

export default async function Page({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <DisputeDetail disputeId={id} />;
}
