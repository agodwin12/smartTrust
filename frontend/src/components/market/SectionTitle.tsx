import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type SectionTitleProps = {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  /** Small leading icon (e.g. the red flash bolt). */
  icon?: ReactNode;
  size?: "md" | "lg";
  className?: string;
};

/** Compact marketplace section header (design guide §31): title + tiny sub-line + "See all". */
export function SectionTitle({ title, subtitle, href, linkLabel, icon, size = "md", className }: SectionTitleProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2">
        {icon}
        <div className="min-w-0">
          <h2 className={cn("truncate font-market font-extrabold tracking-normal text-market-ink", size === "lg" ? "text-[17px] lg:text-[18px]" : "text-[15px]")}>{title}</h2>
          {subtitle && <p className="truncate text-[10px] text-market-muted">{subtitle}</p>}
        </div>
      </div>
      {href && linkLabel && (
        <Link href={href} className="market-link shrink-0 whitespace-nowrap">
          {linkLabel}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
