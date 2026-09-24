import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { privacy } from "@/content/legal";
import { pick } from "@/content/types";
import { ContentPage } from "@/components/content/ContentPage";
import { PageShell } from "@/components/layout/PageShell";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return seo(locale, "/legal/privacy", { title: t("privacy.title") });
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const content = pick(privacy, locale);
  return (
    <PageShell>
      <ContentPage content={content} crumbs={[{ label: content.title }]} />
    </PageShell>
  );
}
