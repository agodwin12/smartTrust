import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Page gutter: 16px on phones, 24px on tablets, 48px on desktop, capped at 1440px (spec 7). */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-12", className)} {...props} />;
}
