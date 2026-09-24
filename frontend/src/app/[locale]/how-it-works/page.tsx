import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { howItWorks } from "@/content/help";
import { pick } from "@/content/types";
import { ContentPage } from "@/components/content/ContentPage";
import { EscrowFlow } from "@/components/home/EscrowFlow";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/layout/Container";
import { SellCta } from "@/components/seller/SellCta";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return seo(locale, "/how-it-works", { title: t("howItWorks.title"), description: t("howItWorks.subtitle") });
}

export default async function HowItWorksPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("plans");
  const content = pick(howItWorks, locale);

  return (
    <PageShell>
      <ContentPage content={content} crumbs={[{ label: content.title }]} />
      <EscrowFlow />
      <Container className="py-14 text-center">
        <h2 className="text-3xl">{t("cta")}</h2>
        <p className="mx-auto mt-2 max-w-xl text-foreground-secondary">{t("ctaDescription")}</p>
        <div className="mt-6 flex justify-center">
          <SellCta />
        </div>
      </Container>
    </PageShell>
  );
}
