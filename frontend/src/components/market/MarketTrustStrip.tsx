import { Lock, PackageCheck, ShieldCheck, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { PaymentBadges } from "@/components/market/PaymentBadges";

const ITEMS: { key: "escrow" | "verified" | "protection"; icon: LucideIcon; badges?: boolean }[] = [
  { key: "escrow", icon: Lock, badges: true },
  { key: "verified", icon: ShieldCheck },
  { key: "protection", icon: PackageCheck },
];

/** Shallow reassurance row (design guide §14): three columns on desktop, only the payment card on phones. */
export async function MarketTrustStrip() {
  const t = await getTranslations("market.trust");

  return (
    <section aria-label={t("label")} className="grid gap-2.5 lg:grid-cols-3">
      {ITEMS.map(({ key, icon: Icon, badges }, i) => (
        <div key={key} className={cn("flex items-center gap-3 rounded-market border border-market-sky bg-market-blue-light px-3 py-2.5 shadow-market", i > 0 && "hidden lg:flex")}>
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-market-navy text-white">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold leading-tight text-market-ink">{t(`${key}.title`)}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-market-text">{t(`${key}.text`)}</p>
          </div>
          {badges && <PaymentBadges size="sm" className="shrink-0" />}
        </div>
      ))}
    </section>
  );
}
