import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  href?: string;
  linkLabel?: string;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeading({ title, subtitle, eyebrow, href, linkLabel, align = "left", className }: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:mb-8",
        align === "center" ? "items-center text-center" : "sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-orange">{eyebrow}</p>
        )}
        <h2 className="text-2xl text-foreground sm:text-3xl lg:text-[2rem]">{title}</h2>
        {subtitle && <p className="mt-1.5 text-sm text-foreground-secondary sm:text-base">{subtitle}</p>}
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="group inline-flex items-center gap-1.5 self-start text-sm font-semibold text-brand-blue transition-colors hover:text-brand-orange sm:self-auto"
        >
          {linkLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
