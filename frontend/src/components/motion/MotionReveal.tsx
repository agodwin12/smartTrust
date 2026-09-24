"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { fadeIn, fadeUp, scaleIn, slideIn, viewportOnce } from "@/lib/motion";

const VARIANTS = { fadeUp, fadeIn, scaleIn, slideIn };

type MotionRevealProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children?: ReactNode;
  variant?: keyof typeof VARIANTS;
  /** Reveal on scroll into view (default) vs. immediately on mount. */
  revealOnScroll?: boolean;
};

export function MotionReveal({
  variant = "fadeUp",
  revealOnScroll = true,
  children,
  ...props
}: MotionRevealProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div>{children}</div>;
  }

  return (
    <motion.div
      variants={VARIANTS[variant]}
      initial="hidden"
      {...(revealOnScroll
        ? { whileInView: "visible", viewport: viewportOnce }
        : { animate: "visible" })}
      {...props}
    >
      {children}
    </motion.div>
  );
}
