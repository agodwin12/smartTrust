"use client";

import { BadgeCheck, MapPin, Package } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { formatCompactNumber, initials } from "@/lib/format";
import { motionConfig } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { RatingStars } from "@/components/marketplace/RatingStars";
import type { Store } from "@/types";

export function StoreCard({ store, className }: { store: Store; className?: string }) {
  const t = useTranslations("stores");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      whileHover={reduceMotion ? undefined : { y: -4 }}
      transition={motionConfig.softSpring}
      className={cn(
        "flex h-full flex-col rounded-2xl border border-border bg-surface p-4 transition-[border-color,box-shadow] duration-300 hover:border-brand-blue/50 hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)] sm:p-5",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl border border-border bg-brand-sky/60 dark:bg-surface-elevated">
          {store.logoUrl ? (
            <Image src={store.logoUrl} alt={store.name} fill sizes="56px" className="object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center font-display text-lg text-brand-blue dark:text-brand-blue-light">
              {initials(store.name)}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 font-sans text-base font-semibold text-foreground">
            <span className="truncate">{store.name}</span>
            {store.verified !== false && (
              <BadgeCheck className="size-4 shrink-0 text-brand-blue" aria-label={t("verified")} />
            )}
          </h3>
          <p className="truncate text-xs text-foreground-muted">
            {store.categoryName ?? t("defaultCategory")}
            {store.location && (
              <>
                {" · "}
                <MapPin className="mb-0.5 inline size-3" /> {store.location}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-xs text-foreground-secondary">
        {typeof store.rating === "number" ? <RatingStars rating={store.rating} /> : <span className="inline-flex items-center gap-1 text-foreground-muted"><BadgeCheck className="size-3.5 text-brand-blue" /> {t("verified")}</span>}
        {typeof store.productCount === "number" && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <Package className="size-3.5" />
            {t("products", { count: formatCompactNumber(store.productCount, locale) })}
          </span>
        )}
      </div>

      <Link
        href={`/stores/${store.slug}`}
        className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-border text-sm font-semibold text-foreground transition-colors hover:border-brand-blue hover:bg-brand-sky/40 hover:text-brand-blue dark:hover:bg-surface-hover dark:hover:text-brand-blue-light"
      >
        {t("viewStore")}
      </Link>
    </motion.article>
  );
}
