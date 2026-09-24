"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link, useRouter } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/format";
import { AuthCard, authField, authPrimaryButton, authSecondaryButton } from "@/components/auth/AuthCard";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuthError } from "@/components/auth/useAuthError";

function VerifyInner() {
  const t = useTranslations("auth.verify");
  const { user, authFetch, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const describeError = useAuthError();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = safeNextPath(searchParams.get("next"));

  if (user?.emailVerifiedAt) {
    return (
      <AuthCard title={t("title")}>
        <p className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="size-5" /> {t("already")}
        </p>
        <Link href={next} className={`${authPrimaryButton} mt-6`}>
          {t("submit")} →
        </Link>
      </AuthCard>
    );
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    setSubmitting(true);
    setError(null);
    try {
      await authFetch("auth/verify-email", { method: "POST", body: { code } });
      await refreshUser();
      toast.success(t("success"));
      router.push(next);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    try {
      await authFetch("auth/resend-verification", { method: "POST" });
      toast.success(t("resent"));
    } catch (err) {
      toast.error(describeError(err));
    }
  };

  return (
    <AuthCard
      title={t("title")}
      subtitle={t("subtitle", { email: user?.email ?? "" })}
      footer={
        <Link href={next} className="text-foreground-muted hover:text-foreground">
          {t("later")}
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <label className="block text-sm font-medium text-foreground">
          {t("code")}
          <input
            name="code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            required
            className={`${authField} mt-1.5 text-center font-mono text-2xl tracking-[0.5em]`}
          />
        </label>
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>}
        <button type="submit" disabled={submitting} className={authPrimaryButton}>
          {t("submit")}
        </button>
        <button type="button" onClick={resend} className={authSecondaryButton}>
          {t("resend")}
        </button>
      </form>
    </AuthCard>
  );
}

export function VerifyEmailForm() {
  return (
    <RequireAuth>
      <VerifyInner />
    </RequireAuth>
  );
}
