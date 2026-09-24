import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { faq } from "@/content/help";
import { pick } from "@/content/types";
import { getPlans } from "@/features/catalog/api";
import { FaqAccordion } from "@/components/content/FaqAccordion";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { SellCta } from "@/components/seller/SellCta";
import { PlanCard } from "@/components/subscriptions/PlanCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHero } from "@/components/ui/PageHero";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "plans" });
  return seo(locale, "/subscriptions", { title: t("title"), description: t("subtitle") });
}

export default async function SubscriptionsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, plans] = await Promise.all([getTranslations("plans"), getPlans()]);
  const sorted = [...plans].sort((a, b) => Number(a.price) - Number(b.price));
  const highlighted = sorted.length >= 3 ? sorted[1].id : sorted[sorted.length - 1]?.id;
  const sellerFaq = pick(faq, locale).find((g) => /sell|vend/i.test(g.group))?.items ?? [];

  return (
    <PageShell>
      <PageHero title={t("title")} subtitle={t("subtitle")} crumbs={[{ label: t("title") }]} />
      <Container className="py-10 sm:py-14">
        {sorted.length === 0 ? (
          <EmptyState title={t("title")} description={t("subtitle")} action={{ label: t("cta"), href: "/sell" }} />
        ) : (
          <div className="grid gap-6 pt-3 lg:grid-cols-3">
            {sorted.map((plan) => (
              <PlanCard key={plan.id} plan={plan} highlighted={plan.id === highlighted} />
            ))}
          </div>
        )}
      </Container>
      {sellerFaq.length > 0 && (
        <section className="border-t border-border bg-surface py-14">
          <Container className="max-w-3xl">
            <h2 className="mb-6 text-3xl">{t("faqTitle")}</h2>
            <FaqAccordion items={sellerFaq} />
          </Container>
        </section>
      )}
      <Container className="py-14 text-center">
        <h2 className="text-3xl">{t("cta")}</h2>
        <p className="mx-auto mt-2 max-w-xl text-foreground-secondary">{t("ctaDescription")}</p>
        <div className="mt-6 flex justify-center">
          <SellCta secondaryHref="/seller-guide" />
        </div>
      </Container>
    </PageShell>
  );
}
