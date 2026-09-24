"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link, useRouter } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/format";
import { AuthCard, authField, authPrimaryButton } from "@/components/auth/AuthCard";
import { useAuthError } from "@/components/auth/useAuthError";

export function RegisterForm() {
  const t = useTranslations("auth.register");
  const ta = useTranslations("auth");
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const describeError = useAuthError();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = safeNextPath(searchParams.get("next"));

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const phone = String(form.get("phone") ?? "").trim();
      const user = await register({
        firstName: String(form.get("firstName")).trim(),
        lastName: String(form.get("lastName")).trim(),
        email: String(form.get("email")).trim(),
        password: String(form.get("password")),
        ...(phone ? { phone } : {}),
      });
      toast.success(ta("welcome", { name: user.firstName }));
      router.push(`/verify-email?next=${encodeURIComponent(next)}`);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <>
          {t("haveAccount")}{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-blue hover:underline">
            {t("login")}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-foreground">
            {t("firstName")}
            <input name="firstName" autoComplete="given-name" required className={`${authField} mt-1.5`} />
          </label>
          <label className="block text-sm font-medium text-foreground">
            {t("lastName")}
            <input name="lastName" autoComplete="family-name" required className={`${authField} mt-1.5`} />
          </label>
        </div>
        <label className="block text-sm font-medium text-foreground">
          {t("email")}
          <input name="email" type="email" autoComplete="email" required className={`${authField} mt-1.5`} />
        </label>
        <label className="block text-sm font-medium text-foreground">
          {t("phone")}
          <input name="phone" type="tel" autoComplete="tel" placeholder="+237 6XX XXX XXX" className={`${authField} mt-1.5`} />
        </label>
        <label className="block text-sm font-medium text-foreground">
          {t("password")}
          <input name="password" type="password" autoComplete="new-password" required minLength={8} className={`${authField} mt-1.5`} />
          <span className="mt-1 block text-xs font-normal text-foreground-muted">{t("passwordHint")}</span>
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting} className={authPrimaryButton}>
          {t("submit")}
        </button>
        <p className="text-xs text-foreground-muted">
          {t.rich("terms", {
            terms: (chunks) => (
              <Link href="/legal/terms" className="underline hover:text-foreground">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/legal/privacy" className="underline hover:text-foreground">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </form>
    </AuthCard>
  );
}
