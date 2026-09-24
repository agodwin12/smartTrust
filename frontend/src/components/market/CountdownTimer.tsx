"use client";

import { useTranslations } from "next-intl";
import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const UNITS = ["hrs", "mins", "secs"] as const;

/** Milliseconds until local midnight, when the deals rail refreshes. */
const untilMidnight = () => {
  const now = new Date();
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return end.getTime() - now.getTime();
};

type CountdownTimerProps = {
  /** Absolute deadline (ISO). Without it the timer counts to local midnight. */
  until?: string | null;
  /** Accessible label, e.g. "Ends in". */
  label?: string;
  className?: string;
};

/**
 * Three red boxes (design guide §12). Renders dashes until hydrated so server and client markup
 * match. Counts to `until` when given (a flash campaign start/end), else to local midnight.
 * Beyond 99 hours the first box shows days instead.
 */
export function CountdownTimer({ until, label, className }: CountdownTimerProps) {
  const t = useTranslations("market.flash");
  const router = useRouter();
  const [left, setLeft] = useState<number | null>(null);
  const expired = useRef(false);

  useEffect(() => {
    const deadline = until ? new Date(until).getTime() : null;
    const tick = () => {
      const remaining = deadline === null ? untilMidnight() : Math.max(0, deadline - Date.now());
      setLeft(remaining);
      // A campaign deadline reached on screen: re-render the page so the sale (or its start)
      // takes effect immediately instead of waiting for the next visit.
      if (deadline !== null && remaining === 0 && !expired.current) {
        expired.current = true;
        setTimeout(() => router.refresh(), 1500);
      }
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [until, router]);

  const seconds = Math.max(0, Math.floor((left ?? 0) / 1000));
  const hours = Math.floor(seconds / 3600);
  const useDays = hours >= 100;
  const parts =
    left === null
      ? ["--", "--", "--"]
      : useDays
        ? [Math.floor(hours / 24), hours % 24, Math.floor((seconds % 3600) / 60)].map((n) => String(n).padStart(2, "0"))
        : [hours, Math.floor((seconds % 3600) / 60), seconds % 60].map((n) => String(n).padStart(2, "0"));
  const units = useDays ? (["days", "hrs", "mins"] as const) : UNITS;

  return (
    <div className={cn("flex items-start gap-1", className)} role="timer" aria-label={label ?? t("endsIn")}>
      {parts.map((part, i) => (
        <Fragment key={units[i]}>
          {i > 0 && <span className="mt-1.5 text-[13px] font-extrabold leading-none text-market-red lg:mt-2">:</span>}
          <div className="flex flex-col items-center">
            <span className="inline-flex h-7 min-w-[34px] items-center justify-center rounded-[6px] bg-market-red px-1.5 font-market text-[13px] font-extrabold tabular-nums text-white lg:h-9 lg:min-w-[42px] lg:text-[15px]">
              {part}
            </span>
            <span className="mt-0.5 text-[8.5px] font-semibold uppercase text-market-muted">{t(units[i])}</span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
