import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuditView } from "@/components/admin/AuditView";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: `${t("nav.audit")} · ${t("title")}`, robots: { index: false } };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AuditView />;
}
