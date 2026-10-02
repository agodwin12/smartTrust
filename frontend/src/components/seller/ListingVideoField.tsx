"use client";

import { Clapperboard, Film, Loader2, RefreshCw, Trash2, TriangleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

export const MAX_VIDEO_SECONDS = 30;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const VIDEO_EXTENSIONS = /\.(mp4|mov|m4v|webm|3gp|mkv|avi)$/i;

export type ListingVideo = Pick<Product, "videoStatus" | "videoUrl" | "videoPosterUrl" | "videoDuration">;
export const pickVideo = (p: Product): ListingVideo => ({ videoStatus: p.videoStatus ?? null, videoUrl: p.videoUrl ?? null, videoPosterUrl: p.videoPosterUrl ?? null, videoDuration: p.videoDuration ?? null });

/** A local file's duration in seconds, or null when this browser can't decode it (e.g. iPhone HEVC on Chrome). */
function readDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const probe = document.createElement("video");
    let settled = false;
    const done = (seconds: number | null) => {
      if (settled) return;
      settled = true;
      probe.removeAttribute("src");
      resolve(seconds);
    };
    probe.preload = "metadata";
    probe.muted = true;
    probe.onloadedmetadata = () => done(Number.isFinite(probe.duration) ? probe.duration : null);
    probe.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    probe.src = url;
  });
}

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

type Props = {
  /** The listing's saved video (edit mode), null for a new listing. */
  current: ListingVideo | null;
  /** The file chosen in this form, uploaded when the listing is saved. */
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Edit mode: deletes the saved video right away. */
  onRemove?: () => Promise<void>;
  /** 0..1 while the chosen file uploads. */
  progress: number | null;
};

/** The listing form's video slot: one optional clip, 30 seconds at most, checked before any upload. */
export function ListingVideoField({ current, file, onFileChange, onRemove, progress }: Props) {
  const t = useTranslations("sellerArea.listingForm.videoField");
  const [selected, setSelected] = useState<{ file: File; url: string; seconds: number | null } | null>(null);
  const [checking, setChecking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const choose = async (list: FileList | null) => {
    const next = list?.[0];
    if (!next) return;
    if (!next.type.startsWith("video/") && !VIDEO_EXTENSIONS.test(next.name)) return void toast.error(t("notVideo"));
    if (next.size > MAX_VIDEO_BYTES) return void toast.error(t("tooLarge"));
    setChecking(true);
    const url = URL.createObjectURL(next);
    const seconds = await readDuration(url);
    setChecking(false);
    if (seconds !== null && seconds > MAX_VIDEO_SECONDS + 0.5) {
      URL.revokeObjectURL(url);
      return void toast.error(t("tooLong", { seconds: Math.round(seconds) }));
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
    setSelected({ file: next, url, seconds });
    onFileChange(next);
  };

  const clearSelection = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setSelected(null);
    onFileChange(null);
  };

  const remove = async () => {
    if (!onRemove) return;
    setRemoving(true);
    try {
      await onRemove();
    } finally {
      setRemoving(false);
    }
  };

  // The selection is shown only while the parent still holds that file (it clears it once uploaded).
  const pending = selected && file === selected.file ? selected : null;
  const picker = (label: string, icon = <RefreshCw className="size-3.5" aria-hidden />) => (
    <label className={cn(action, "cursor-pointer")}>
      {icon} {label}
      <input type="file" accept="video/*" className="sr-only" onChange={(e) => void choose(e.target.files).finally(() => (e.target.value = ""))} />
    </label>
  );

  return (
    <div>
      <p className="text-sm font-medium text-foreground">{t("label")}</p>
      <p className="text-xs text-foreground-muted">{t("hint")}</p>

      <div className="mt-2">
        {pending ? (
          <div className={frame}>
            {pending.seconds !== null ? (
              <video src={pending.url} controls muted playsInline className={player} />
            ) : (
              <div className={cn(player, "flex flex-col items-center justify-center gap-1 bg-surface-hover text-foreground-muted")}>
                <Film className="size-6" aria-hidden />
                <span className="px-3 text-center text-xs">{t("noPreview")}</span>
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="truncate text-sm font-semibold text-foreground">{pending.file.name}</p>
              <p className="text-xs text-foreground-muted">
                {megabytes(pending.file.size)}
                {pending.seconds !== null && ` · ${t("seconds", { seconds: Math.round(pending.seconds) })}`}
              </p>
              <p className="text-xs text-foreground-secondary">{current?.videoUrl || current?.videoStatus === "PROCESSING" ? t("willReplace") : t("willUpload")}</p>
              {progress !== null ? (
                <div role="status" aria-live="polite">
                  <p className="text-xs font-semibold text-brand-blue">{t("uploading", { percent: Math.round(progress * 100) })}</p>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-hover">
                    <div className="h-full rounded-full bg-brand-orange transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-foreground-muted">{t("keepOpen")}</p>
                </div>
              ) : (
                <button type="button" onClick={clearSelection} className={action}>
                  <X className="size-3.5" aria-hidden /> {t("cancelSelection")}
                </button>
              )}
            </div>
          </div>
        ) : current?.videoStatus === "READY" && current.videoUrl ? (
          <div className={frame}>
            <video src={current.videoUrl} poster={current.videoPosterUrl ?? undefined} controls muted playsInline preload="none" className={player} />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-semibold text-success">{t("live", { seconds: Math.round(current.videoDuration ?? 0) })}</p>
              <div className="flex flex-wrap gap-2">
                {picker(t("replace"))}
                {onRemove && (
                  <button type="button" disabled={removing} onClick={remove} className={cn(action, "border-danger/40 text-danger hover:border-danger hover:text-danger")}>
                    {removing ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Trash2 className="size-3.5" aria-hidden />} {t("remove")}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : current?.videoStatus === "PROCESSING" ? (
          <div className={cn(frame, "items-center")} role="status">
            <Loader2 className="size-6 shrink-0 animate-spin text-brand-orange" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{t("processing")}</p>
              <p className="text-xs text-foreground-muted">{t("processingHint")}</p>
            </div>
          </div>
        ) : (
          <>
            {current?.videoStatus === "FAILED" && (
              <p role="alert" className="mb-2 flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("failed")}
              </p>
            )}
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border px-4 py-6 text-center text-foreground-muted transition-colors hover:border-brand-blue hover:text-brand-blue">
              {checking ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <Clapperboard className="size-6" aria-hidden />}
              <span className="text-sm font-semibold">{checking ? t("checking") : t("add")}</span>
              <span className="text-xs">{t("addHint")}</span>
              <input type="file" accept="video/*" disabled={checking} className="sr-only" onChange={(e) => void choose(e.target.files).finally(() => (e.target.value = ""))} />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

const frame = "flex flex-col gap-3 rounded-2xl border border-border p-3 sm:flex-row sm:items-start sm:gap-4";
const player = "aspect-video w-full shrink-0 rounded-xl bg-black object-contain sm:w-64";
const action = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:border-brand-blue hover:text-brand-blue disabled:opacity-60";
