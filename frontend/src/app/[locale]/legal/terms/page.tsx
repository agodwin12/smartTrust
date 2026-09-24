import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { terms } from "@/content/legal";
import { pick } from "@/content/types";
import { ContentPage } from "@/components/content/ContentPage";
import { PageShell } from "@/components/layout/PageShell";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return seo(locale, "/legal/terms", { title: t("terms.title") });
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const content = pick(terms, locale);
  return (
    <PageShell>
      <ContentPage content={content} crumbs={[{ label: content.title }]} />
    </PageShell>
  );
}
