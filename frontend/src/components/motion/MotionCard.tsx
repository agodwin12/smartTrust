"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { motionConfig } from "@/lib/motion";
import { cn } from "@/lib/utils";

// Generic hover-elevate wrapper for product/store cards (spec 15): card rises,
// shadow deepens. Border/image-scale hover states stay in the card's own Tailwind
// classes (`group-hover:` on children) since they're style, not motion.
export function MotionCard({ className, children, ...props }: HTMLMotionProps<"div">) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn("group", className)}
      whileHover={reduceMotion ? undefined : { y: -6, transition: motionConfig.softSpring }}
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
