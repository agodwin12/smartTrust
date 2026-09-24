"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Main photo + thumbnail strip. Keyboard accessible: thumbnails are buttons. */
export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const active = images[index] ?? images[0];

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border bg-surface-hover">
        {active && (
          <Image key={active} src={active} alt={title} fill priority sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" />
        )}
      </div>
      {images.length > 1 && (
        <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${title} ${i + 1}`}
              aria-pressed={i === index}
              className={cn(
                "relative size-20 shrink-0 overflow-hidden rounded-xl border-2 transition-colors",
                i === index ? "border-brand-blue" : "border-transparent hover:border-border"
              )}
            >
              <Image src={src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
