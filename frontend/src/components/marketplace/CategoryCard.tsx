"use client";

import {
  Baby,
  Car,
  Dumbbell,
  LayoutGrid,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sparkles,
  Laptop,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { motionConfig } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

const ICONS: Record<string, LucideIcon> = {
  electronics: Laptop,
  fashion: Shirt,
  "home-living": Sofa,
  "beauty-health": Sparkles,
  sports: Dumbbell,
  automotive: Car,
  "phones-tablets": Smartphone,
  "kids-toys": Baby,
  groceries: ShoppingBasket,
};

export function CategoryCard({ category, className }: { category: Category; className?: string }) {
  const t = useTranslations("categories");
  const reduceMotion = useReducedMotion();
  const Icon = ICONS[category.slug] ?? LayoutGrid;

  return (
    <motion.div whileHover={reduceMotion ? undefined : { y: -3 }} transition={motionConfig.spring} className={cn("h-full", className)}>
      <Link
        href={`/categories/${category.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-[border-color,box-shadow] duration-300 hover:border-brand-blue hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand-blue)_12%,transparent)]"
      >
        <div className="relative aspect-square overflow-hidden bg-surface-hover">
          {category.imageUrl ? (
            <Image
              src={category.imageUrl}
              alt={category.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Icon className="size-10 text-brand-blue" />
            </div>
          )}
          <span className="absolute bottom-2.5 left-2.5 inline-flex size-9 items-center justify-center rounded-xl bg-background/90 text-brand-blue shadow-sm backdrop-blur transition-colors group-hover:text-brand-orange">
            <Icon className="size-4.5" />
          </span>
        </div>
        <div className="p-3">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{category.name}</p>
          {typeof category.productCount === "number" && (
            <p className="mt-0.5 text-xs text-foreground-muted">{t("productCount", { count: category.productCount })}</p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
