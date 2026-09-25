"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type AutoRailProps = {
  children: ReactNode;
  /** Width of one item per breakpoint, e.g. "w-[calc((100%-0.5rem)/2)] lg:w-[calc((100%-1.5rem)/4)]". */
  itemClassName: string;
  /** Milliseconds between automatic page turns. */
  interval?: number;
  className?: string;
  label?: string;
};

/**
 * Horizontal product rail that turns one page (the visible width) every `interval` ms and
 * loops back to the start. It pauses while hovered, focused, touched or off-screen, and
 * never moves for visitors who prefer reduced motion. Swipe and arrow buttons still work.
 */
export function AutoRail({ children, itemClassName, interval = 5000, className, label }: AutoRailProps) {
  const t = useTranslations("market.rail");
  const railRef = useRef<HTMLUListElement>(null);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [page, setPage] = useState({ index: 0, count: 1 });
  const resumeTimer = useRef<number | undefined>(undefined);
  const items = Children.toArray(children);

  const measure = useCallback(() => {
    const el = railRef.current;
    if (!el || el.clientWidth === 0) return;
    const count = Math.max(1, Math.round(el.scrollWidth / el.clientWidth));
    const index = Math.min(count - 1, Math.round(el.scrollLeft / el.clientWidth));
    setPage((prev) => (prev.index === index && prev.count === count ? prev : { index, count }));
  }, []);

  const go = useCallback((direction: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    const atStart = el.scrollLeft <= 4;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
    if (direction === 1 && atEnd) el.scrollTo({ left: 0, behavior });
    else if (direction === -1 && atStart) el.scrollTo({ left: el.scrollWidth, behavior });
    else el.scrollBy({ left: direction * el.clientWidth, behavior });
  }, []);

  // Only run while the rail is on screen and the tab is visible.
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.4 });
    observer.observe(el);
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    return () => {
      observer.disconnect();
      resize.disconnect();
    };
  }, [measure]);

  useEffect(() => {
    if (paused || !visible || page.count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") go(1);
    }, interval);
    return () => window.clearInterval(id);
  }, [paused, visible, page.count, interval, go]);

  useEffect(() => () => window.clearTimeout(resumeTimer.current), []);

  // After a touch, give the visitor a few seconds before sliding again.
  const pauseForTouch = () => {
    setPaused(true);
    window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => setPaused(false), interval * 2);
  };

  const arrow =
    "absolute top-1/2 z-10 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-market-navy shadow-[0_4px_12px_rgba(8,45,97,0.25)] transition-colors hover:bg-market-orange hover:text-white sm:inline-flex";

  return (
    <div
      className={cn("group/rail relative", className)}
      onPointerEnter={(e) => e.pointerType === "mouse" && setPaused(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setPaused(false)}
      onTouchStart={pauseForTouch}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <ul ref={railRef} aria-label={label} onScroll={measure} className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth">
        {items.map((child, i) => (
          <li key={i} className={cn("shrink-0 snap-start", itemClassName)}>
            {child}
          </li>
        ))}
      </ul>

      {page.count > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label={t("previous")} className={cn(arrow, "-left-2 opacity-0 group-hover/rail:opacity-100 focus-visible:opacity-100")}>
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={() => go(1)} aria-label={t("next")} className={cn(arrow, "-right-2 opacity-0 group-hover/rail:opacity-100 focus-visible:opacity-100")}>
            <ChevronRight className="size-4" aria-hidden />
          </button>
          <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
            {Array.from({ length: page.count }, (_, i) => (
              <span key={i} className={cn("h-1.5 rounded-full transition-all", i === page.index ? "w-4 bg-market-orange" : "w-1.5 bg-market-border")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
