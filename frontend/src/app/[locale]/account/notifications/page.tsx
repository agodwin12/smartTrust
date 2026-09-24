import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NotificationsView } from "@/components/notifications/NotificationsView";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "notifications" });
  return { title: t("title"), robots: { index: false } };
}

export default async function NotificationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("notifications");
  return (
    <>
      <h1 className="text-3xl">{t("title")}</h1>
      <p className="mb-6 mt-1 text-sm text-foreground-secondary">{t("subtitle")}</p>
      <NotificationsView />
    </>
  );
}
