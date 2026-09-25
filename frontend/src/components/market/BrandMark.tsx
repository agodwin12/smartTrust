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

/** The Smarttrustexpress logo, cropped to its artwork (public/logo-header.png, 993x198, transparent). */
export function BrandMark({ tone = "dark", size = "md", className, priority = true }: BrandMarkProps) {
  const onNavy = tone === "dark";
  // Phones: 28px tall but never wider than 40% of the screen, so the header icons always fit.
  const height = size === "sm" ? "h-7 max-w-[40vw]" : "h-9";
  return (
    <Link
      href="/"
      aria-label="Smart Market — home"
      className={cn("inline-flex shrink-0 items-center", onNavy && "rounded-[7px] bg-white px-2 py-1", className)}
    >
      <Image src="/logo-header.png" alt="Smarttrustexpress" width={993} height={198} sizes="(max-width: 1024px) 40vw, 200px" priority={priority} className={cn("w-auto object-contain object-left", height)} />
    </Link>
  );
}
