import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  /** "dark" sits on the navy header (the logo gets a white plate so its blue wordmark stays legible), "light" on a white surface. */
  tone?: "dark" | "light";
  size?: "sm" | "md";
  className?: string;
  /** Load eagerly when the mark is above the fold (the header always is). */
  priority?: boolean;
};

/** The SmartPlaze logo, cropped to its artwork (public/brand/smartplaze-logo.png, 1005x232, transparent). On a white plate on the navy bar and in dark mode, where the blue lettering would not read. */
export function BrandMark({ tone = "dark", size = "md", className, priority = true }: BrandMarkProps) {
  const onNavy = tone === "dark";
  // Phones: 28px tall but never wider than 40% of the screen, so the header icons always fit.
  const height = size === "sm" ? "h-7 max-w-[40vw]" : "h-9";
  return (
    <Link
      href="/"
      aria-label="SmartPlaze — home"
      className={cn("inline-flex shrink-0 items-center", onNavy ? "rounded-[7px] bg-white px-2 py-1" : "dark:rounded-[7px] dark:bg-white dark:px-2 dark:py-1", className)}
    >
      <Image src="/brand/smartplaze-logo.png" alt="SmartPlaze" width={1005} height={232} sizes="(max-width: 1024px) 40vw, 200px" priority={priority} className={cn("w-auto object-contain object-left", height)} />
    </Link>
  );
}
