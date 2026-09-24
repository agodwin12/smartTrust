import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { sellerGuide } from "@/content/help";
import { pick } from "@/content/types";
import { ContentPage } from "@/components/content/ContentPage";
import { PageShell } from "@/components/layout/PageShell";
import { SellCta } from "@/components/seller/SellCta";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return seo(locale, "/seller-guide", { title: t("sellerGuide.title"), description: t("sellerGuide.subtitle") });
}

export default async function SellerGuidePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const content = pick(sellerGuide, locale);

  return (
    <PageShell>
      <ContentPage content={content} crumbs={[{ label: content.title }]}>
        <div className="mt-12">
          <SellCta />
        </div>
      </ContentPage>
    </PageShell>
  );
}
