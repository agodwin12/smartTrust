import { Check, Sparkles } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@/types";

function featureList(features: SubscriptionPlan["features"]): string[] {
  if (!features) return [];
  if (Array.isArray(features)) return features.map(String);
  return Object.entries(features)
    .filter(([, v]) => v === true || typeof v === "string")
    .map(([k, v]) => (typeof v === "string" ? v : k));
}

/** Spec 22: premium plan card — one highlighted plan, no aggressive "best deal" pressure. */
export async function PlanCard({ plan, highlighted = false, ctaHref }: { plan: SubscriptionPlan; highlighted?: boolean; ctaHref?: string }) {
  const t = await getTranslations("plans");
  const locale = await getLocale();

  const items = [
    t("ads", { count: plan.adQuota }),
    t("duration", { days: plan.durationDays }),
    plan.heroEligible && plan.heroDurationHours ? t("hero", { hours: plan.heroDurationHours }) : t("noHero"),
    t("escrowIncluded"),
    t("walletIncluded"),
    ...(highlighted ? [t("supportIncluded")] : []),
    ...featureList(plan.features),
  ];

  return (
    <article
      className={cn(
        "relative flex h-full flex-col rounded-3xl border bg-surface p-6 transition-[border-color,box-shadow] sm:p-7",
        highlighted ? "border-brand-blue shadow-[0_24px_60px_-32px_color-mix(in_oklab,var(--brand-blue)_60%,transparent)]" : "border-border"
      )}
    >
      {highlighted && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-brand-orange px-3 py-1 text-xs font-semibold text-white">
          <Sparkles className="size-3" /> {t("recommended")}
        </span>
      )}
      <h3 className="font-sans text-xl font-semibold text-foreground">{plan.name}</h3>
      <p className="mt-3 font-script text-4xl text-brand-blue dark:text-brand-blue-light">{formatPrice(plan.price, locale)}</p>
      <p className="text-sm text-foreground-muted">/ {t("duration", { days: plan.durationDays })}</p>
      <ul className="mt-6 space-y-2.5 text-sm text-foreground-secondary">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-success" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref ?? `/seller/subscription?plan=${plan.id}`}
        className={cn(
          "mt-8 inline-flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition-colors",
          highlighted ? "bg-brand-orange text-white hover:bg-brand-orange-light" : "border border-border text-foreground hover:border-brand-blue hover:text-brand-blue"
        )}
      >
        {t("choose", { name: plan.name })}
      </Link>
    </article>
  );
}
