import type { Metadata } from "next";
import { Clock, Mail, MessageCircleQuestion } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { ContactForm } from "@/components/support/ContactForm";
import { PageHero } from "@/components/ui/PageHero";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return seo(locale, "/help/contact", { title: t("contact.title"), description: t("contact.subtitle") });
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tc] = await Promise.all([getTranslations("pages"), getTranslations("contact")]);

  return (
    <PageShell>
      <PageHero title={t("contact.title")} subtitle={t("contact.subtitle")} crumbs={[{ label: t("contact.title") }]} size="compact" />
      <Container className="py-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
            <ContactForm />
          </div>
          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="font-sans text-sm font-semibold uppercase tracking-wider text-foreground-muted">{tc("other")}</h2>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 size-4 text-brand-blue" />
                  <span>
                    <span className="block text-foreground-muted">{tc("emailUs")}</span>
                    <a href="mailto:support@smartmarket.dev" className="font-semibold text-foreground hover:text-brand-blue">
                      support@smartmarket.dev
                    </a>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="mt-0.5 size-4 text-brand-blue" />
                  <span className="text-foreground-secondary">{tc("hours")}</span>
                </li>
              </ul>
            </div>
            <Link href="/help/faq" className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-5 text-sm font-semibold text-foreground transition-colors hover:border-brand-blue hover:text-brand-blue">
              <MessageCircleQuestion className="size-5 text-brand-orange" /> {t("faq.title")}
            </Link>
          </aside>
        </div>
      </Container>
    </PageShell>
  );
}
