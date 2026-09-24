import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Marketplace gutter: 12px on phones, 16px from tablets, content capped at 1440px (design guide §7). */
export function MarketContainer({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1440px] px-3 sm:px-4", className)} {...props} />;
}
