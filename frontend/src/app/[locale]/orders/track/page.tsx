import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { CheckoutGroupView } from "@/components/orders/CheckoutGroupView";
import { PageHero } from "@/components/ui/PageHero";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "orders.group" });
  return seo(locale, "/orders/track", { title: t("trackTitle"), robots: { index: false } }, { noIndex: true });
}

/** Guest order tracking: opened from the tracking link (?id&token) or by reference + phone. */
export default async function TrackOrderPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "orders.group" });
  return (
    <PageShell>
      <PageHero title={t("trackTitle")} subtitle={t("trackSubtitle")} size="compact" />
      <Container className="py-8 sm:py-12">
        <Suspense fallback={null}>
          <CheckoutGroupView mode="track" />
        </Suspense>
      </Container>
    </PageShell>
  );
}
