import { useId } from "react";
import { cn } from "@/lib/utils";

export type FlagCode = "gb" | "fr";

/**
 * Inline SVG flags for the language switcher. Emoji flags are avoided on purpose: Windows
 * renders them as two-letter codes and the site never uses emoji as imagery.
 */
export function Flag({ code, className }: { code: FlagCode; className?: string }) {
  const clipId = useId();
  const shared = cn("inline-block h-[14px] w-[20px] shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10", className);

  if (code === "fr") {
    return (
      <svg viewBox="0 0 3 2" className={shared} aria-hidden focusable="false">
        <rect width="1" height="2" x="0" fill="#0055a4" />
        <rect width="1" height="2" x="1" fill="#ffffff" />
        <rect width="1" height="2" x="2" fill="#ef4135" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 60 30" className={shared} aria-hidden focusable="false">
      <clipPath id={clipId}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${clipId})`} stroke="#c8102e" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#ffffff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  );
}
