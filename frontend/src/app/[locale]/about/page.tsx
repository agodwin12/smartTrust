import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { about } from "@/content/company";
import { pick } from "@/content/types";
import { HERO_IMAGES } from "@/lib/demo-data";
import { ContentPage } from "@/components/content/ContentPage";
import { PageShell } from "@/components/layout/PageShell";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return seo(locale, "/about", { title: t("about.title"), description: t("about.subtitle") });
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const content = pick(about, locale);
  return (
    <PageShell>
      <ContentPage content={content} crumbs={[{ label: content.title }]} image={HERO_IMAGES.seller} />
    </PageShell>
  );
}
