"use client";

import { motion, useReducedMotion } from "motion/react";
import { fadeUp } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/marketplace/ProductCard";
import type { Product } from "@/types";

type ProductGridProps = {
  products: Product[];
  className?: string;
  /** Mark the first row as high priority for LCP when the grid is near the top of the page. */
  priorityCount?: number;
};

// Each card reveals on its own as it scrolls into view. A grid-level reveal would need a
// fixed share of a possibly very tall grid on screen — on phones that left long listings blank.
const cardViewport = { once: true, amount: 0.15 } as const;

export function ProductGrid({ products, className, priorityCount = 0 }: ProductGridProps) {
  const reduceMotion = useReducedMotion();

  return (
    <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4", className)}>
      {products.map((product, index) => (
        <motion.li
          key={product.id}
          variants={reduceMotion ? undefined : fadeUp}
          initial={reduceMotion ? undefined : "hidden"}
          whileInView={reduceMotion ? undefined : "visible"}
          viewport={cardViewport}
          className="min-w-0"
        >
          <ProductCard product={product} priority={index < priorityCount} />
        </motion.li>
      ))}
    </ul>
  );
}
