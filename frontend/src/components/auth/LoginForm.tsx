"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link, useRouter } from "@/i18n/navigation";
import { apiUrl } from "@/lib/api";
import { safeNextPath } from "@/lib/format";
import { AuthCard, authField, authPrimaryButton, authSecondaryButton } from "@/components/auth/AuthCard";
import { useAuthError } from "@/components/auth/useAuthError";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.1 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" />
    </svg>
  );
}

export function LoginForm() {
  const t = useTranslations("auth.login");
  const ta = useTranslations("auth");
  const { login } = useAuth();
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
      const user = await login(String(form.get("email")), String(form.get("password")));
      toast.success(ta("welcome", { name: user.firstName }));
      router.push(next);
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
          {t("noAccount")}{" "}
          <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-blue hover:underline">
            {t("register")}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <label className="block text-sm font-medium text-foreground">
          {t("email")}
          <input name="email" type="email" autoComplete="email" required className={`${authField} mt-1.5`} />
        </label>
        <label className="block text-sm font-medium text-foreground">
          <span className="flex items-center justify-between">
            {t("password")}
            <Link href="/forgot-password" className="text-xs font-semibold text-brand-blue hover:underline">
              {t("forgot")}
            </Link>
          </span>
          <input name="password" type="password" autoComplete="current-password" required className={`${authField} mt-1.5`} />
        </label>
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>}
        <button type="submit" disabled={submitting} className={authPrimaryButton}>
          {t("submit")}
        </button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-foreground-muted">
        <span className="h-px flex-1 bg-border" /> {ta("login.google") ? "·" : ""} <span className="h-px flex-1 bg-border" />
      </div>
      <a href={apiUrl("auth/google")} className={authSecondaryButton}>
        <GoogleIcon /> {t("google")}
      </a>
    </AuthCard>
  );
}
