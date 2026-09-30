import { Gift } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The offer's last day, as sellers in Cameroon read it. */
export const launchOfferDate = (endsAt: string, locale: string) => formatDate(endsAt, locale, { dateStyle: "long", timeZone: "Africa/Douala" });

/** "Sell for free until …" — shown on the pricing pages while the launch offer runs. */
export function LaunchOfferBanner({ endsAt, action, className }: { endsAt: string; action?: ReactNode; className?: string }) {
  const t = useTranslations("plans.launch");
  const locale = useLocale();

  return (
    <section
      aria-label={t("badge")}
      className={cn(
        "flex flex-col gap-4 rounded-3xl border border-brand-orange/40 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--brand-orange)_14%,var(--surface)),var(--surface))] p-5 sm:flex-row sm:items-center sm:p-6",
        className
      )}
    >
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-orange text-white shadow-[0_10px_24px_-12px_var(--brand-orange)]">
        <Gift className="size-6" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-orange">{t("badge")}</p>
        <h2 className="mt-1 font-sans text-xl font-bold text-foreground sm:text-2xl">{t("title", { date: launchOfferDate(endsAt, locale) })}</h2>
        <p className="mt-1.5 text-sm text-foreground-secondary sm:text-base">{t("body")}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </section>
  );
}
