"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

type MotionStaggerProps = Omit<HTMLMotionProps<"div">, "children"> & { children?: ReactNode };

export function MotionStagger({ children, ...props }: MotionStaggerProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div>{children}</div>;
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Drop-in child item for MotionStagger — inherits the parent's stagger timing. */
export function MotionStaggerItem({ children, ...props }: MotionStaggerProps) {
  return (
    <motion.div variants={fadeUp} {...props}>
      {children}
    </motion.div>
  );
}
