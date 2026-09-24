"use client";

import { useTranslations } from "next-intl";
import { Fragment, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const UNITS = ["hrs", "mins", "secs"] as const;

/** Milliseconds until local midnight, when the deals rail refreshes. */
const untilMidnight = () => {
  const now = new Date();
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return end.getTime() - now.getTime();
};

/** Three red boxes (design guide §12). Renders dashes until hydrated so server and client markup match. */
export function CountdownTimer({ className }: { className?: string }) {
  const t = useTranslations("market.flash");
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeft(untilMidnight());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const seconds = Math.max(0, Math.floor((left ?? 0) / 1000));
  const parts = left === null ? ["--", "--", "--"] : [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((n) => String(n).padStart(2, "0"));

  return (
    <div className={cn("flex items-start gap-1", className)} role="timer" aria-label={t("endsIn")}>
      {parts.map((part, i) => (
        <Fragment key={UNITS[i]}>
          {i > 0 && <span className="mt-1.5 text-[13px] font-extrabold leading-none text-market-red lg:mt-2">:</span>}
          <div className="flex flex-col items-center">
            <span className="inline-flex h-7 min-w-[34px] items-center justify-center rounded-[6px] bg-market-red px-1.5 font-market text-[13px] font-extrabold tabular-nums text-white lg:h-9 lg:min-w-[42px] lg:text-[15px]">
              {part}
            </span>
            <span className="mt-0.5 text-[8.5px] font-semibold uppercase text-market-muted">{t(UNITS[i])}</span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
