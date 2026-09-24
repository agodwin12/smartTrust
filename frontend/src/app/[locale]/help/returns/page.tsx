import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { returns } from "@/content/help";
import { pick } from "@/content/types";
import { ContentPage } from "@/components/content/ContentPage";
import { PageShell } from "@/components/layout/PageShell";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return seo(locale, "/help/returns", { title: t("returns.title"), description: t("returns.subtitle") });
}

export default async function ReturnsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const content = pick(returns, locale);
  return (
    <PageShell>
      <ContentPage content={content} crumbs={[{ label: content.title }]} />
    </PageShell>
  );
}
