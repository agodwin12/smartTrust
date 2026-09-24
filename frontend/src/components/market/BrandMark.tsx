import { ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  /** "dark" sits on the navy header, "light" on a white surface. */
  tone?: "dark" | "light";
  size?: "sm" | "md";
  className?: string;
};

/** Text lockup from the reference design: "Smart Market" over a small "Smarttrustexpress" line. */
export function BrandMark({ tone = "dark", size = "md", className }: BrandMarkProps) {
  const onNavy = tone === "dark";
  return (
    <Link href="/" aria-label="Smart Market — home" className={cn("flex shrink-0 flex-col leading-none", className)}>
      <span className={cn("font-market font-extrabold tracking-tight", size === "sm" ? "text-[18px]" : "text-[21px]", onNavy ? "text-white" : "text-market-navy")}>
        Smart <span className="text-market-orange">Market</span>
      </span>
      <span className={cn("mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold", onNavy ? "text-white/75" : "text-market-blue")}>
        <ShieldCheck className="size-3" aria-hidden />
        Smarttrustexpress
      </span>
    </Link>
  );
}
