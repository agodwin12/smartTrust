"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Store } from "@/types";
import { authField, authPrimaryButton } from "@/components/auth/AuthCard";
import { useAuthError } from "@/components/auth/useAuthError";

type StoreFormProps = { mode: "create" | "edit"; initial?: Store | null };

function ImagePicker({ label, name, current, aspect }: { label: string; name: "logo" | "banner"; current?: string | null; aspect: "square" | "wide" }) {
  const t = useTranslations("sellerArea.storeForm");
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  const src = preview ?? current ?? null;

  return (
    <label className="block text-sm font-medium text-foreground">
      {label}
      <span className={cn("mt-1.5 flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-border bg-background p-3 transition-colors hover:border-brand-blue", aspect === "wide" && "flex-col items-stretch")}>
        <span className={cn("relative shrink-0 overflow-hidden rounded-xl bg-surface-hover", aspect === "square" ? "size-20" : "aspect-[16/6] w-full")}>
          {src ? <Image src={src} alt="" fill unoptimized sizes={aspect === "square" ? "80px" : "600px"} className="object-cover" /> : <ImagePlus className="absolute inset-0 m-auto size-6 text-foreground-muted" />}
        </span>
        <span className="text-xs text-foreground-muted">{src && !preview ? t("current") : t("choose")}</span>
        <input
          type="file"
          name={name}
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
        />
      </span>
    </label>
  );
}

export function StoreForm({ mode, initial }: StoreFormProps) {
  const t = useTranslations("sellerArea.storeForm");
  const to = useTranslations("sellerArea.onboarding");
  const { authFetch, refreshUser } = useAuth();
  const router = useRouter();
  const describeError = useAuthError();
  const [saving, setSaving] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    // Drop empty file inputs so the API doesn't see zero-byte uploads.
    for (const key of ["logo", "banner"]) {
      const file = form.get(key);
      if (file instanceof File && file.size === 0) form.delete(key);
    }
    // An unticked checkbox is absent from FormData; send an explicit false so it can be switched off.
    form.set("acceptsCashOnDelivery", form.get("acceptsCashOnDelivery") === "true" ? "true" : "false");
    setSaving(true);
    try {
      if (mode === "create") {
        await authFetch("stores", { method: "POST", body: form });
        await refreshUser();
        toast.success(to("success"));
        router.push("/seller/subscription");
      } else {
        await authFetch("stores/me", { method: "PATCH", body: form });
        await refreshUser();
        toast.success(t("saved"));
        router.refresh();
      }
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-3xl border border-border bg-surface p-6">
      <label className="block text-sm font-medium text-foreground">
        {t("name")}
        <input name="name" required minLength={2} maxLength={80} defaultValue={initial?.name ?? ""} className={`${authField} mt-1.5`} />
      </label>
      <label className="block text-sm font-medium text-foreground">
        {t("description")}
        <textarea name="description" rows={4} maxLength={2000} defaultValue={initial?.description ?? ""} placeholder={t("descriptionPlaceholder")} className={`${authField} mt-1.5 h-auto py-3`} />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-foreground">
          {t("location")}
          <input name="location" maxLength={160} defaultValue={initial?.location ?? ""} placeholder="Douala" className={`${authField} mt-1.5`} />
        </label>
        <label className="block text-sm font-medium text-foreground">
          {t("contactPhone")}
          <input name="contactPhone" type="tel" maxLength={30} defaultValue={initial?.contactPhone ?? ""} placeholder="+237 6XX XXX XXX" className={`${authField} mt-1.5`} />
        </label>
      </div>
      <label className="block text-sm font-medium text-foreground">
        {t("contactEmail")}
        <input name="contactEmail" type="email" defaultValue={initial?.contactEmail ?? ""} className={`${authField} mt-1.5`} />
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4">
        <input type="checkbox" name="acceptsCashOnDelivery" value="true" defaultChecked={initial?.acceptsCashOnDelivery ?? true} className="mt-1 size-4 accent-[var(--brand-blue)]" />
        <span>
          <span className="block text-sm font-medium text-foreground">{t("cod.label")}</span>
          <span className="block text-xs text-foreground-muted">{t("cod.hint")}</span>
        </span>
      </label>
      <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
        <ImagePicker label={t("logo")} name="logo" current={initial?.logoUrl} aspect="square" />
        <ImagePicker label={t("banner")} name="banner" current={initial?.bannerUrl} aspect="wide" />
      </div>
      <button type="submit" disabled={saving} className={`${authPrimaryButton} sm:w-auto sm:px-6`}>
        {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
        {mode === "create" ? t("create") : t("save")}
      </button>
    </form>
  );
}
