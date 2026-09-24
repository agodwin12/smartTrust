import type { Variants } from "motion/react";

// Central motion configuration — see docs/Smart_Market_Dark_Premium_Design_System_for_Claude_Code.md, sections 12 & 37.
// Starting points, not absolute values — tune per component as the UI settles.
export const motionConfig = {
  fast: 0.18,
  normal: 0.3,
  slow: 0.55,

  spring: {
    type: "spring" as const,
    stiffness: 380,
    damping: 30,
    mass: 0.7,
  },

  softSpring: {
    type: "spring" as const,
    stiffness: 240,
    damping: 28,
    mass: 0.8,
  },
};

// Reusable variants — keep entrances subtle (spec 14: translateY 20px, never 200px).
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: motionConfig.normal, ease: "easeOut" } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: motionConfig.normal, ease: "easeOut" } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: motionConfig.spring },
};

export const slideIn: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: motionConfig.normal, ease: "easeOut" } },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

// Section entrance threshold (spec 14): reveal once ~20–30% of the section is visible.
export const viewportOnce = { once: true, amount: 0.25 } as const;
