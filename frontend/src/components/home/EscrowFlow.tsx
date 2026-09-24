"use client";

import { CircleHelp, Handshake, Landmark, PackageCheck, Truck, Wallet, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { motion, useInView, useReducedMotion, type Variants } from "motion/react";
import { useRef } from "react";
import { Container } from "@/components/layout/Container";

const STEPS: { key: "pay" | "hold" | "deliver" | "confirm" | "paid"; icon: LucideIcon }[] = [
  { key: "pay", icon: Wallet },
  { key: "hold", icon: Landmark },
  { key: "deliver", icon: Truck },
  { key: "confirm", icon: PackageCheck },
  { key: "paid", icon: Handshake },
];

// Whole sequence stays under ~1.5s (spec 20): 5 steps × 0.22s stagger + 0.4s each.
const STEP_DELAY = 0.22;

const iconVariants: Variants = {
  hidden: { opacity: 0, scale: 0.7 },
  visible: (i: number) => ({
    opacity: 1,
    scale: [0.7, 1.12, 1],
    transition: { delay: 0.15 + i * STEP_DELAY, duration: 0.4, ease: "easeOut" },
  }),
};
const textVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.3 + i * STEP_DELAY, duration: 0.3 } }),
};

export function EscrowFlow() {
  const t = useTranslations("escrow");
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const state = reduceMotion || inView ? "visible" : "hidden";

  return (
    <section id="escrow" className="border-y border-border bg-surface py-14 sm:py-20">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-orange">{t("eyebrow")}</p>
          <h2 className="mt-3 text-2xl text-foreground sm:text-3xl lg:text-4xl">{t("title")}</h2>
          <p className="mt-3 text-sm text-foreground-secondary sm:text-base">{t("subtitle")}</p>
        </div>

        <div ref={ref} className="relative mt-12">
          {/* Desktop connecting line: draws itself once the section is in view. */}
          <svg
            aria-hidden
            className="absolute left-[10%] right-[10%] top-8 hidden h-1 w-[80%] lg:block"
            viewBox="0 0 100 2"
            preserveAspectRatio="none"
          >
            <line x1="0" y1="1" x2="100" y2="1" stroke="var(--border)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <motion.line
              x1="0"
              y1="1"
              x2="100"
              y2="1"
              stroke="var(--brand-blue)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
              animate={{ pathLength: state === "visible" ? 1 : 0 }}
              transition={{ duration: 1.2, ease: "easeInOut", delay: 0.1 }}
            />
          </svg>

          {/* Mobile/tablet vertical rail */}
          <div aria-hidden className="absolute bottom-6 left-7 top-6 w-px bg-border lg:hidden">
            <motion.div
              className="w-full origin-top bg-brand-blue"
              initial={reduceMotion ? { scaleY: 1 } : { scaleY: 0 }}
              animate={{ scaleY: state === "visible" ? 1 : 0 }}
              transition={{ duration: 1.2, ease: "easeInOut", delay: 0.1 }}
              style={{ height: "100%" }}
            />
          </div>

          <ol className="relative grid gap-7 lg:grid-cols-5 lg:gap-4">
            {STEPS.map(({ key, icon: Icon }, i) => (
              <li key={key} className="flex items-start gap-4 lg:flex-col lg:items-center lg:text-center">
                <motion.span
                  custom={i}
                  variants={reduceMotion ? undefined : iconVariants}
                  initial={reduceMotion ? undefined : "hidden"}
                  animate={state}
                  className="relative z-10 inline-flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-brand-blue bg-surface text-brand-blue shadow-[0_0_0_6px_var(--surface)] dark:text-brand-blue-light lg:size-16"
                >
                  <Icon className="size-6" />
                  <span className="absolute -right-1 -top-1 inline-flex size-5 items-center justify-center rounded-full bg-brand-orange text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                </motion.span>
                <motion.div
                  custom={i}
                  variants={reduceMotion ? undefined : textVariants}
                  initial={reduceMotion ? undefined : "hidden"}
                  animate={state}
                  className="pt-2 lg:pt-4"
                >
                  <h3 className="font-sans text-base font-semibold text-foreground">{t(`steps.${key}.title`)}</h3>
                  <p className="mt-1 text-sm text-foreground-secondary">{t(`steps.${key}.description`)}</p>
                </motion.div>
              </li>
            ))}
          </ol>
        </div>

        <p className="mx-auto mt-10 flex max-w-xl items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-center text-sm text-foreground-secondary">
          <CircleHelp className="size-4 shrink-0 text-brand-orange" />
          {t("dispute")}
        </p>
      </Container>
    </section>
  );
}
