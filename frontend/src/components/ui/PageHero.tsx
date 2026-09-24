import Image from "next/image";
import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { cn } from "@/lib/utils";

type PageHeroProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  crumbs?: Crumb[];
  image?: string | null;
  children?: ReactNode;
  className?: string;
  size?: "default" | "compact";
};

/** Title band shared by every inner page: breadcrumbs, H1, optional intro/actions and cover image. */
export function PageHero({ title, subtitle, eyebrow, crumbs, image, children, className, size = "default" }: PageHeroProps) {
  return (
    <section className={cn("relative overflow-hidden border-b border-border bg-surface", className)}>
      {image && (
        <>
          <Image src={image} alt="" fill sizes="100vw" className="object-cover opacity-30 dark:opacity-25" priority />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--surface)_35%,transparent)]" />
        </>
      )}
      <Container className={cn("relative", size === "compact" ? "py-6 sm:py-8" : "py-10 sm:py-14")}>
        {crumbs && <Breadcrumbs items={crumbs} className="mb-4" />}
        {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-orange">{eyebrow}</p>}
        <h1 className={cn("text-foreground", size === "compact" ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl")}>{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-base text-foreground-secondary sm:text-lg">{subtitle}</p>}
        {children && <div className="mt-6">{children}</div>}
      </Container>
    </section>
  );
}
