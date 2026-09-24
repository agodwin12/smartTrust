"use client";

import { BadgeCheck, ChevronLeft, ChevronRight, ShieldCheck, Umbrella } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { animate, motion, useMotionValue, useReducedMotion, type PanInfo } from "motion/react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "@/i18n/navigation";
import { DEMO_PRODUCTS, HERO_IMAGES } from "@/lib/demo-data";
import { cn } from "@/lib/utils";
import { PaymentBadges } from "@/components/market/PaymentBadges";
import type { Product } from "@/types";

type SlideKey = "marketplace" | "deals" | "sell" | "escrow";

const SLIDES: { key: SlideKey; href: string; lead?: string }[] = [
  { key: "marketplace", href: "/products" },
  { key: "deals", href: "/deals" },
  { key: "sell", href: "/sell", lead: HERO_IMAGES.seller },
  { key: "escrow", href: "/how-it-works", lead: HERO_IMAGES.escrow },
];

const AUTOPLAY_MS = 6500;
const SWIPE_OFFSET = 50;
const SWIPE_VELOCITY = 400;

const TRUST = [
  { key: "secure", icon: ShieldCheck },
  { key: "verified", icon: BadgeCheck },
  { key: "protection", icon: Umbrella },
] as const;

type Visual = { src: string; alt: string };

/** Three product photos per slide, rotating through the featured listings (demo photos fill any gap). */
function visualsFor(products: Product[], slide: number, lead?: string): Visual[] {
  const real = products.filter((p) => p.images?.[0]).map((p) => ({ src: p.images![0], alt: p.title }));
  const demo = DEMO_PRODUCTS.map((p) => ({ src: p.images![0], alt: p.title }));
  const pool = real.length >= 3 ? real : [...real, ...demo];
  const picks = [0, 1, 2].map((i) => pool[(slide * 3 + i) % pool.length]);
  return lead ? [{ src: lead, alt: "" }, picks[0], picks[1]] : picks;
}

function Frame({ visual, priority, className }: { visual: Visual; priority?: boolean; className: string }) {
  return (
    <div className={cn("absolute overflow-hidden rounded-[8px] bg-white shadow-[0_10px_24px_-10px_rgba(8,45,97,0.5)] ring-1 ring-white/70 dark:ring-white/10", className)}>
      <Image src={visual.src} alt={visual.alt} fill sizes="140px" priority={priority} draggable={false} className="object-cover" />
    </div>
  );
}

function Montage({ visuals, priority }: { visuals: Visual[]; priority: boolean }) {
  const [a, b, c] = visuals;
  return (
    <div className="relative h-[112px] w-[128px] shrink-0 sm:h-[150px] sm:w-[200px] lg:h-[164px] lg:w-[250px]" aria-hidden>
      <Frame visual={a} priority={priority} className="left-0 top-1 size-[92px] -rotate-3 sm:size-[126px] lg:size-[140px]" />
      <Frame visual={b} className="right-4 top-0 size-[62px] rotate-2 sm:right-6 sm:size-[90px] lg:right-10 lg:size-[96px]" />
      <Frame visual={c} className="bottom-0 right-0 size-[56px] -rotate-2 sm:size-[80px] lg:size-[88px]" />
    </div>
  );
}

/** Compact Jumia-style banner slider (design guide §10): 4 swipeable slides + a fixed escrow panel on desktop. */
export function HeroBanner({ products }: { products: Product[] }) {
  const t = useTranslations("market.hero");
  const reduceMotion = !!useReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const total = SLIDES.length;
  const autoplay = !reduceMotion && !hovering && !dragging && tabVisible;

  useEffect(() => {
    const sync = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // The track moves in pixels so drag constraints line up with slide edges.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const settle = useCallback(
    (to: number) => {
      animate(x, -to * width, reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 32, mass: 0.8 });
    },
    [x, width, reduceMotion]
  );

  useEffect(() => {
    settle(index);
  }, [index, settle, tabVisible]);

  const goTo = useCallback((to: number) => setIndex(((to % total) + total) % total), [total]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (!autoplay) return;
    const id = setTimeout(next, AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [autoplay, next]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setDragging(false);
    if (info.offset.x < -SWIPE_OFFSET || info.velocity.x < -SWIPE_VELOCITY) return goTo(Math.min(index + 1, total - 1));
    if (info.offset.x > SWIPE_OFFSET || info.velocity.x > SWIPE_VELOCITY) return goTo(Math.max(index - 1, 0));
    settle(index);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      prev();
    }
  };

  const arrow = "absolute top-1/2 z-10 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-market-navy shadow-[0_4px_12px_rgba(8,45,97,0.25)] transition-colors hover:bg-market-orange hover:text-white sm:inline-flex";

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("label")}
      onKeyDown={onKeyDown}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      className="relative flex h-[172px] overflow-hidden rounded-[12px] font-market shadow-market sm:h-[196px] lg:h-[212px]"
    >
      {/* Slides */}
      <div ref={viewportRef} className="relative h-full min-w-0 flex-1 overflow-hidden bg-[linear-gradient(110deg,var(--market-hero-from),var(--market-hero-to))]">
        <motion.div
          className="flex h-full cursor-grab active:cursor-grabbing"
          style={{ x, width: `${total * 100}%` }}
          drag="x"
          dragConstraints={{ left: -(total - 1) * width, right: 0 }}
          dragElastic={0.08}
          dragMomentum={false}
          onDragStart={() => setDragging(true)}
          onDragEnd={onDragEnd}
        >
          {SLIDES.map((slide, i) => {
            const active = i === index;
            const Heading = i === 0 ? "h1" : "h2";
            return (
              <div
                key={slide.key}
                role="group"
                aria-roledescription="slide"
                aria-label={t("status", { index: i + 1, total })}
                aria-hidden={!active}
                style={{ width: `${100 / total}%` }}
                className="flex h-full items-center gap-3 px-4 sm:px-8 lg:px-9"
              >
                <div className="min-w-0 flex-1">
                  <Heading className="line-clamp-3 max-w-[24ch] font-market text-[17px] font-extrabold leading-[1.05] tracking-tight text-market-ink sm:text-[24px] lg:text-[27px]">
                    {t(`slides.${slide.key}.title`)}
                  </Heading>
                  <p className="mt-1.5 line-clamp-1 max-w-[44ch] text-[11.5px] font-medium text-market-text sm:line-clamp-2 sm:text-[12.5px] lg:text-[13px]">{t(`slides.${slide.key}.subtitle`)}</p>
                  <Link
                    href={slide.href}
                    tabIndex={active ? 0 : -1}
                    draggable={false}
                    className="mt-2.5 inline-flex h-9 items-center rounded-[7px] bg-market-orange px-5 text-[13px] font-bold text-white shadow-[0_6px_14px_-6px_var(--market-orange)] transition-colors hover:bg-market-orange-dark lg:mt-3 lg:h-10"
                  >
                    {t(`slides.${slide.key}.cta`)}
                  </Link>
                </div>
                <Montage visuals={visualsFor(products, i, slide.lead)} priority={i === 0} />
              </div>
            );
          })}
        </motion.div>

        <button type="button" onClick={prev} aria-label={t("previous")} className={cn(arrow, "left-2")}>
          <ChevronLeft className="size-4" />
        </button>
        <button type="button" onClick={next} aria-label={t("next")} className={cn(arrow, "right-2")}>
          <ChevronRight className="size-4" />
        </button>

        <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5" role="tablist" aria-label={t("label")}>
          {SLIDES.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={t("goTo", { index: i + 1 })}
              onClick={() => goTo(i)}
              className={cn("h-1.5 rounded-full transition-[width,background-color]", i === index ? "w-4 bg-market-orange" : "w-1.5 bg-market-navy/30 hover:bg-market-navy/60 dark:bg-white/40")}
            />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          {t("status", { index: index + 1, total })}
        </p>
      </div>

      {/* Fixed escrow panel (desktop) */}
      <aside className="relative hidden w-[262px] shrink-0 flex-col justify-center bg-market-navy py-3 pl-8 pr-5 text-white lg:flex xl:w-[290px]">
        <span aria-hidden className="absolute -left-4 top-0 h-full w-8 -skew-x-[9deg] bg-market-navy" />
        <div className="relative">
          <p className="text-[13px] font-extrabold uppercase tracking-wide">{t("escrow.title")}</p>
          <p className="mt-1 text-[12px] leading-snug text-white/80">{t("escrow.subtitle")}</p>
          <PaymentBadges size="sm" className="mt-2.5" />
          <ul className="mt-3 flex items-start gap-2">
            {TRUST.map(({ key, icon: Icon }) => (
              <li key={key} className="flex w-[68px] flex-col items-center text-center">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-market-blue text-white">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="mt-1 text-[9.5px] font-semibold leading-tight text-white/90">{t(`escrow.${key}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </section>
  );
}
