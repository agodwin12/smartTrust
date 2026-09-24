import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { faq } from "@/content/help";
import { pick } from "@/content/types";
import { FaqAccordion } from "@/components/content/FaqAccordion";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return seo(locale, "/help/faq", { title: t("faq.title"), description: t("faq.subtitle") });
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tc] = await Promise.all([getTranslations("pages"), getTranslations("contact")]);
  const groups = pick(faq, locale);

  return (
    <PageShell>
      <PageHero title={t("faq.title")} subtitle={t("faq.subtitle")} crumbs={[{ label: t("faq.title") }]} size="compact" />
      <Container className="max-w-3xl py-10 sm:py-14">
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.group}>
              <h2 className="mb-4 text-2xl">{group.group}</h2>
              <FaqAccordion items={group.items} />
            </section>
          ))}
        </div>
        <p className="mt-12 rounded-2xl border border-border bg-surface p-5 text-sm text-foreground-secondary">
          {tc("other")}:{" "}
          <Link href="/help/contact" className="font-semibold text-brand-blue hover:underline">
            {t("contact.title")}
          </Link>
        </p>
      </Container>
    </PageShell>
  );
}
