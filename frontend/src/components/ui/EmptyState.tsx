import type { LucideIcon } from "lucide-react";
import { PackageSearch } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: { label: string; href: string };
  className?: string;
};

/** Spec 34: an empty state explains what's missing and offers the next step — never a bare "no data". */
export function EmptyState({ title, description, icon: Icon = PackageSearch, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center", className)}>
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-brand-sky/70 text-brand-blue dark:bg-surface-elevated dark:text-brand-blue-light">
        <Icon className="size-6" />
      </span>
      <h3 className="mt-4 font-sans text-lg font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-foreground-secondary">{description}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-light"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
