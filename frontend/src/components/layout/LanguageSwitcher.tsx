"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Flag, type FlagCode } from "@/components/ui/Flag";

const FLAGS: Record<AppLocale, FlagCode> = { en: "gb", fr: "fr" };

/**
 * Full variant: a two-flag segmented control. Compact variant (phones): a single round button
 * showing the *other* language's flag, so switching is one tap from the header bar.
 */
type Tone = "light" | "dark";

export function LanguageSwitcher({ className, compact = false, tone = "light" }: { className?: string; compact?: boolean; tone?: Tone }) {
  const t = useTranslations("nav");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const switchTo = (next: AppLocale) => {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  if (compact) {
    const other = routing.locales.find((code) => code !== locale) ?? locale;
    return (
      <button
        type="button"
        onClick={() => switchTo(other)}
        aria-label={t("switchTo", { language: t(`languageNames.${other}`) })}
        title={t("switchTo", { language: t(`languageNames.${other}`) })}
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-full border text-xs font-bold transition-colors",
          tone === "dark" ? "border-white/25 text-white hover:bg-white/10" : "border-border bg-surface text-foreground hover:border-brand-blue hover:text-brand-blue",
          isPending && "opacity-60",
          className
        )}
      >
        <Flag code={FLAGS[other]} />
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={cn(
        "inline-flex h-9 items-center rounded-full border p-0.5 text-xs font-semibold",
        tone === "dark" ? "border-white/25 bg-white/10" : "border-border bg-surface",
        isPending && "opacity-60",
        className
      )}
    >
      {routing.locales.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => switchTo(code)}
          aria-pressed={code === locale}
          aria-label={t(`languageNames.${code}`)}
          title={t(`languageNames.${code}`)}
          className={cn(
            "inline-flex items-center rounded-full px-2 py-1.5 transition-colors",
            code === locale
              ? tone === "dark"
                ? "bg-white text-market-navy shadow-sm"
                : "bg-brand-blue text-white shadow-sm"
              : tone === "dark"
                ? "text-white/80 hover:bg-white/15 hover:text-white"
                : "text-foreground-secondary hover:bg-surface-hover hover:text-foreground"
          )}
        >
          <Flag code={FLAGS[code]} className={cn(code !== locale && "opacity-70")} />
          <span className="sr-only">{t(`languageNames.${code}`)}</span>
        </button>
      ))}
    </div>
  );
}
