import type { Metadata } from "next";
import { BadgeCheck, Sparkles, Wallet, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPlans } from "@/features/catalog/api";
import { HERO_IMAGES } from "@/lib/demo-data";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { SellCta } from "@/components/seller/SellCta";
import { PlanCard } from "@/components/subscriptions/PlanCard";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sell" });
  return seo(locale, "/sell", { title: t("eyebrow"), description: t("description") });
}

const BENEFITS = [
  { key: 1, icon: ShieldCheck },
  { key: 2, icon: Wallet },
  { key: 3, icon: Sparkles },
  { key: 4, icon: BadgeCheck },
] as const;

export default async function SellPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, plans] = await Promise.all([getTranslations("sell"), getPlans()]);
  const sorted = [...plans].sort((a, b) => Number(a.price) - Number(b.price));

  return (
    <PageShell>
      <section className="hero-ambient relative overflow-hidden border-b border-border">
        <Container className="grid items-center gap-10 py-12 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-orange">{t("eyebrow")}</p>
            <h1 className="mt-3 text-4xl sm:text-5xl lg:text-6xl">{t("title")}</h1>
            <p className="mt-5 max-w-xl text-base text-foreground-secondary sm:text-lg">{t("description")}</p>
            <div className="mt-8">
              <SellCta />
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border shadow-[0_40px_80px_-40px_rgba(0,0,0,0.45)]">
            <Image src={HERO_IMAGES.seller} alt="" fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          </div>
        </Container>
      </section>

      <Container className="py-14">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ key, icon: Icon }) => (
            <li key={key} className="rounded-2xl border border-border bg-surface p-5">
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-sky/70 text-brand-blue dark:bg-surface-elevated dark:text-brand-blue-light">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 font-sans text-base font-semibold text-foreground">{t(`benefit${key}Title`)}</h3>
              <p className="mt-1.5 text-sm text-foreground-secondary">{t(`benefit${key}Description`)}</p>
            </li>
          ))}
        </ul>
      </Container>

      <section id="steps" className="scroll-mt-28 border-y border-border bg-surface py-14">
        <Container>
          <h2 className="text-3xl">{t("stepsTitle")}</h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <li key={n} className="flex gap-4">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-orange font-display text-lg text-white">{n}</span>
                <div>
                  <h3 className="font-sans text-base font-semibold text-foreground">{t(`step${n}Title`)}</h3>
                  <p className="mt-1 text-sm text-foreground-secondary">{t(`step${n}Description`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {sorted.length > 0 && (
        <Container className="py-14">
          <h2 className="text-3xl">{t("plansTitle")}</h2>
          <div className="mt-8 grid gap-6 pt-3 lg:grid-cols-3">
            {sorted.map((plan, i) => (
              <PlanCard key={plan.id} plan={plan} highlighted={i === 1} />
            ))}
          </div>
          <p className="mt-8 text-center">
            <Link href="/seller-guide" className="font-semibold text-brand-blue hover:underline">
              {t("guide")} →
            </Link>
          </p>
        </Container>
      )}
    </PageShell>
  );
}
