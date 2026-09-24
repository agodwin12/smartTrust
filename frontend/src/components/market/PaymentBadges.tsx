import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Mobile Money operator chips in the operators' colours. Text only: no trademarked artwork is
 * bundled with the site, so the chips read "MTN Mobile Money" and "Orange Money" instead.
 */
export function PaymentBadges({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  const t = useTranslations("market.payments");
  const chip = cn(
    "inline-flex flex-col items-center justify-center rounded-[6px] font-extrabold leading-none shadow-sm",
    size === "sm" ? "h-8 w-[54px] text-[10px]" : "h-10 w-[64px] text-[11px]"
  );
  const sub = cn("mt-0.5 font-semibold", size === "sm" ? "text-[7px]" : "text-[8px]");

  return (
    <div className={cn("flex items-center gap-1.5", className)} role="img" aria-label={`${t("mtn")}, ${t("orange")}`}>
      <span className={cn(chip, "bg-market-mtn text-[#1a1a1a]")}>
        MTN
        <span className={cn(sub, "opacity-80")}>{t("mtnShort")}</span>
      </span>
      <span className={cn(chip, "bg-market-om text-white")}>
        Orange
        <span className={cn(sub, "opacity-90")}>Money</span>
      </span>
    </div>
  );
}
