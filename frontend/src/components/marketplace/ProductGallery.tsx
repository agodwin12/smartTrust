"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";

type GalleryVideo = { url: string; poster: string | null };

/**
 * Main photo + thumbnail strip, with the product video (if any) as the second item. The video
 * never plays or downloads by itself: only its poster loads until the buyer presses play.
 */
export function ProductGallery({ images, title, video }: { images: string[]; title: string; video?: GalleryVideo | null }) {
  const t = useTranslations("products");
  const items: ({ kind: "image"; src: string } | { kind: "video"; src: string; poster: string | null })[] = images.map((src) => ({ kind: "image" as const, src }));
  if (video) items.splice(Math.min(1, items.length), 0, { kind: "video", src: video.url, poster: video.poster });
  const [index, setIndex] = useState(0);
  const active = items[index] ?? items[0];

  return (
    <div className="space-y-3">
      <div className={cn("relative aspect-[4/3] overflow-hidden rounded-3xl border border-border", active?.kind === "video" ? "bg-black" : "bg-surface-hover")}>
        {active?.kind === "video" ? (
          <video key={active.src} src={active.src} poster={active.poster ?? undefined} controls muted playsInline preload="none" aria-label={t("videoOf", { title })} className="size-full object-contain" />
        ) : (
          active && <Image key={active.src} src={active.src} alt={title} fill priority sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" />
        )}
      </div>
      {items.length > 1 && (
        <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
          {items.map((item, i) => (
            <button
              key={item.src + i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={item.kind === "video" ? t("playVideo") : `${title} ${i + 1}`}
              aria-pressed={i === index}
              className={cn(
                "relative size-20 shrink-0 overflow-hidden rounded-xl border-2 bg-black transition-colors",
                i === index ? "border-brand-blue" : "border-transparent hover:border-border"
              )}
            >
              {item.kind === "video" ? (
                <>
                  {item.poster && <Image src={item.poster} alt="" fill sizes="80px" className="object-cover opacity-80" />}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-black/60 text-white">
                      <Play className="size-4 fill-current" aria-hidden />
                    </span>
                  </span>
                </>
              ) : (
                <Image src={item.src} alt="" fill sizes="80px" className="object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
