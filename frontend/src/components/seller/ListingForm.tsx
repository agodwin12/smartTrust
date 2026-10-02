"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Category, Product } from "@/types";
import { authField } from "@/components/auth/AuthCard";
import { useAuthError } from "@/components/auth/useAuthError";
import { ListingVideoField, pickVideo, type ListingVideo } from "@/components/seller/ListingVideoField";

const MAX_IMAGES = 8;

type ListingFormProps = { mode: "create" | "edit"; initial?: Product | null; categories: Category[] };

export function ListingForm({ mode, initial, categories }: ListingFormProps) {
  const t = useTranslations("sellerArea.listingForm");
  const tl = useTranslations("sellerArea.listings");
  const tp = useTranslations("products");
  const { authFetch, authUpload } = useAuth();
  const router = useRouter();
  const describeError = useAuthError();
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState<null | "draft" | "publish">(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [video, setVideo] = useState<ListingVideo | null>(initial ? pickVideo(initial) : null);

  // While the saved video is being converted, check back every few seconds.
  const listingId = initial?.id;
  useEffect(() => {
    if (!listingId || video?.videoStatus !== "PROCESSING") return;
    const timer = setInterval(() => {
      authFetch<{ advertisement: Product }>(`advertisements/me/${listingId}`)
        .then(({ advertisement }) => setVideo(pickVideo(advertisement)))
        .catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [listingId, video?.videoStatus, authFetch]);

  // Leaving the page would cancel a video upload in progress: ask first.
  useEffect(() => {
    if (videoProgress === null) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [videoProgress]);

  const removeVideo = async () => {
    if (!listingId || !window.confirm(t("videoField.confirmRemove"))) return;
    try {
      const { advertisement } = await authFetch<{ advertisement: Product }>(`advertisements/${listingId}/video`, { method: "DELETE" });
      setVideo(pickVideo(advertisement));
      toast.success(t("videoField.removed"));
    } catch (err) {
      toast.error(describeError(err));
    }
  };

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const groups = useMemo(() => {
    const roots = categories.filter((c) => !c.parentId).sort((a, b) => a.name.localeCompare(b.name));
    return roots.map((root) => ({ root, children: categories.filter((c) => c.parentId === root.id).sort((a, b) => a.name.localeCompare(b.name)) }));
  }, [categories]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files, ...Array.from(list)];
    if (next.length > MAX_IMAGES) toast.error(t("tooMany"));
    setFiles(next.slice(0, MAX_IMAGES));
  };

  const submit = async (event: FormEvent<HTMLFormElement>, publishAfter: boolean) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.delete("images");
    files.forEach((file) => form.append("images", file));
    // Untouched optional fields would fail validation as empty strings (except compareAtPrice, which "" clears).
    if (!String(form.get("location") ?? "").trim()) form.delete("location");
    if (mode === "create" && !String(form.get("compareAtPrice") ?? "").trim()) form.delete("compareAtPrice");

    setSaving(publishAfter ? "publish" : "draft");
    try {
      const { advertisement } =
        mode === "create"
          ? await authFetch<{ advertisement: Product }>("advertisements", { method: "POST", body: form })
          : await authFetch<{ advertisement: Product }>(`advertisements/${initial!.id}`, { method: "PATCH", body: form });
      toast.success(mode === "create" ? t("created") : t("updated"));
      if (publishAfter && advertisement.status !== "PUBLISHED") {
        try {
          await authFetch(`advertisements/${advertisement.id}/publish`, { method: "POST" });
          toast.success(tl("published"));
        } catch (err) {
          toast.error(describeError(err));
        }
      }
      if (videoFile) {
        setVideoProgress(0);
        try {
          const body = new FormData();
          body.append("video", videoFile);
          const { advertisement: withVideo } = await authUpload<{ advertisement: Product }>(`advertisements/${advertisement.id}/video`, body, setVideoProgress);
          setVideo(pickVideo(withVideo));
          setVideoFile(null);
          toast.success(t("videoField.uploaded"));
        } catch (err) {
          toast.error(describeError(err));
          // The listing itself is saved: carry on from its edit page, where the video can be sent again.
          if (mode === "create") router.push(`/seller/listings/${advertisement.id}/edit`);
          return;
        } finally {
          setVideoProgress(null);
        }
      }
      router.push("/seller/listings");
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setSaving(null);
    }
  };

  return (
    <form onSubmit={(e) => submit(e, false)} className="space-y-5 rounded-3xl border border-border bg-surface p-6">
      <div>
        <h1 className="text-3xl">{mode === "create" ? t("createTitle") : t("editTitle")}</h1>
        <p className="mt-1 text-sm text-foreground-secondary">{t("subtitle")}</p>
      </div>

      <label className="block text-sm font-medium text-foreground">
        {t("title")}
        <input name="title" required minLength={3} maxLength={120} defaultValue={initial?.title ?? ""} placeholder={t("titlePlaceholder")} className={`${authField} mt-1.5`} />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-foreground">
          {t("category")}
          <select name="categoryId" required defaultValue={initial?.categoryId ?? ""} className={`${authField} mt-1.5`}>
            <option value="" disabled>
              {t("selectCategory")}
            </option>
            {groups.map(({ root, children }) => (
              <optgroup key={root.id} label={root.name}>
                <option value={root.id}>{root.name}</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    — {child.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-foreground">
          {t("condition")}
          <select name="condition" defaultValue={initial?.condition ?? "NEW"} className={`${authField} mt-1.5`}>
            <option value="NEW">{tp("condition.NEW")}</option>
            <option value="USED">{tp("condition.USED")}</option>
          </select>
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-foreground">
          {t("price")}
          <input name="price" type="number" min={1} step={1} required defaultValue={initial ? Number(initial.price) : ""} className={`${authField} mt-1.5`} />
        </label>
        <label className="block text-sm font-medium text-foreground">
          {t("compareAtPrice")}
          <input name="compareAtPrice" type="number" min={1} step={1} defaultValue={initial?.compareAtPrice ? Number(initial.compareAtPrice) : ""} className={`${authField} mt-1.5`} />
          <span className="mt-1 block text-xs font-normal text-foreground-muted">{t("compareAtHint")}</span>
        </label>
      </div>

      <label className="block text-sm font-medium text-foreground">
        {t("location")}
        <input name="location" maxLength={160} defaultValue={initial?.location ?? ""} placeholder="Douala" className={`${authField} mt-1.5`} />
      </label>

      <label className="block text-sm font-medium text-foreground">
        {t("description")}
        <textarea name="description" required minLength={10} maxLength={5000} rows={6} defaultValue={initial?.description ?? ""} placeholder={t("descriptionPlaceholder")} className={`${authField} mt-1.5 h-auto py-3`} />
      </label>

      <div>
        <p className="text-sm font-medium text-foreground">{t("images")}</p>
        <p className="text-xs text-foreground-muted">{t("imagesHint")}</p>
        {mode === "edit" && initial?.images?.length ? <p className="mt-1 text-xs text-foreground-muted">{t("keepImages")}</p> : null}
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {mode === "edit" &&
            files.length === 0 &&
            initial?.images?.map((src) => (
              <div key={src} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-hover opacity-80">
                <Image src={src} alt="" fill sizes="120px" className="object-cover" />
              </div>
            ))}
          {previews.map((src, i) => (
            <div key={src} className={cn("relative aspect-square overflow-hidden rounded-xl border bg-surface-hover", i === 0 ? "border-brand-orange" : "border-border")}>
              <Image src={src} alt="" fill unoptimized sizes="120px" className="object-cover" />
              <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow" aria-label="×">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {files.length < MAX_IMAGES && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border text-foreground-muted transition-colors hover:border-brand-blue hover:text-brand-blue">
              <ImagePlus className="size-6" />
              <span className="mt-1 text-[11px]">{files.length}/{MAX_IMAGES}</span>
              <input type="file" name="images" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => addFiles(e.target.files)} />
            </label>
          )}
        </div>
      </div>

      <ListingVideoField current={video} file={videoFile} onFileChange={setVideoFile} onRemove={mode === "edit" ? removeVideo : undefined} progress={videoProgress} />

      <div className="flex flex-wrap gap-3 pt-2">
        <button type="submit" disabled={saving !== null} className="inline-flex h-12 items-center gap-2 rounded-xl border border-border px-6 text-sm font-semibold text-foreground hover:border-brand-blue hover:text-brand-blue disabled:opacity-60">
          {saving === "draft" && <Loader2 className="size-4 animate-spin" />} {mode === "create" ? t("save") : t("update")}
        </button>
        <button type="button" disabled={saving !== null} onClick={(e) => submit({ preventDefault() {}, currentTarget: e.currentTarget.form! } as unknown as FormEvent<HTMLFormElement>, true)} className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-orange px-6 text-sm font-semibold text-white hover:bg-brand-orange-light disabled:opacity-60">
          {saving === "publish" && <Loader2 className="size-4 animate-spin" />} {t("saveAndPublish")}
        </button>
      </div>
    </form>
  );
}
