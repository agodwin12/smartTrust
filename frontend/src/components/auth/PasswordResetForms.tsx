"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api";
import { AuthCard, authField, authPrimaryButton } from "@/components/auth/AuthCard";
import { useAuthError } from "@/components/auth/useAuthError";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const describeError = useAuthError();
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setSubmitting(true);
    try {
      await apiFetch("auth/forgot-password", { method: "POST", body: { email } });
      setSentTo(email);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      {sentTo ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-success/10 px-3.5 py-3 text-sm text-foreground">{t("sent")}</p>
          <Link href={`/reset-password?email=${encodeURIComponent(sentTo)}`} className={authPrimaryButton}>
            {t("continue")}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <label className="block text-sm font-medium text-foreground">
            {t("email")}
            <input name="email" type="email" autoComplete="email" required className={`${authField} mt-1.5`} />
          </label>
          <button type="submit" disabled={submitting} className={authPrimaryButton}>
            {t("submit")}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations("auth.reset");
  const router = useRouter();
  const searchParams = useSearchParams();
  const describeError = useAuthError();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("auth/reset-password", {
        method: "POST",
        body: { email: String(form.get("email")).trim(), code: String(form.get("code")).trim(), newPassword: String(form.get("newPassword")) },
      });
      toast.success(t("success"));
      router.push("/login");
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <label className="block text-sm font-medium text-foreground">
          {t("email")}
          <input name="email" type="email" autoComplete="email" required defaultValue={searchParams.get("email") ?? ""} className={`${authField} mt-1.5`} />
        </label>
        <label className="block text-sm font-medium text-foreground">
          {t("code")}
          <input name="code" inputMode="numeric" maxLength={6} autoComplete="one-time-code" required className={`${authField} mt-1.5 font-mono tracking-[0.4em]`} />
        </label>
        <label className="block text-sm font-medium text-foreground">
          {t("newPassword")}
          <input name="newPassword" type="password" autoComplete="new-password" required minLength={8} className={`${authField} mt-1.5`} />
        </label>
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>}
        <button type="submit" disabled={submitting} className={authPrimaryButton}>
          {t("submit")}
        </button>
      </form>
    </AuthCard>
  );
}
