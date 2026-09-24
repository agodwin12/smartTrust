"use client";

import { BadgeCheck, CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { authField, authPrimaryButton } from "@/components/auth/AuthCard";
import { useAuthError } from "@/components/auth/useAuthError";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.1 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" />
    </svg>
  );
}

export function ProfileForms() {
  const t = useTranslations("account.profile");
  const { user, authFetch, refreshUser } = useAuth();
  const describeError = useAuthError();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (!user) return null;

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const phone = String(form.get("phone") ?? "").trim();
    setSavingProfile(true);
    try {
      await authFetch("users/me", {
        method: "PATCH",
        body: { firstName: String(form.get("firstName")).trim(), lastName: String(form.get("lastName")).trim(), phone: phone || null },
      });
      await refreshUser();
      toast.success(t("saved"));
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSavingPassword(true);
    setPasswordError(null);
    try {
      await authFetch("users/me/password", {
        method: "PATCH",
        body: { currentPassword: String(data.get("currentPassword")), newPassword: String(data.get("newPassword")) },
      });
      toast.success(t("password.updated"));
      form.reset();
    } catch (err) {
      setPasswordError(describeError(err));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground-secondary">{t("subtitle")}</p>
      </div>

      <form onSubmit={saveProfile} className="space-y-4 rounded-3xl border border-border bg-surface p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-foreground">
            {t("firstName")}
            <input name="firstName" defaultValue={user.firstName} required className={`${authField} mt-1.5`} />
          </label>
          <label className="block text-sm font-medium text-foreground">
            {t("lastName")}
            <input name="lastName" defaultValue={user.lastName} required className={`${authField} mt-1.5`} />
          </label>
        </div>
        <label className="block text-sm font-medium text-foreground">
          {t("phone")}
          <input name="phone" type="tel" defaultValue={user.phone ?? ""} placeholder="+237 6XX XXX XXX" className={`${authField} mt-1.5`} />
        </label>
        <div className="text-sm font-medium text-foreground">
          {t("email")}
          <div className={`${authField} mt-1.5 flex items-center justify-between bg-surface-hover text-foreground-secondary`}>
            <span className="truncate">{user.email}</span>
            {user.emailVerifiedAt ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                <BadgeCheck className="size-4" /> {t("verified")}
              </span>
            ) : (
              <Link href="/verify-email?next=%2Faccount%2Fprofile" className="inline-flex items-center gap-1 text-xs font-semibold text-warning hover:underline">
                <CircleAlert className="size-4" /> {t("unverified")} · {t("verifyLink")}
              </Link>
            )}
          </div>
        </div>
        {user.googleId && (
          <p className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground-secondary">
            <GoogleMark /> {t("google")}
          </p>
        )}
        <button type="submit" disabled={savingProfile} className={`${authPrimaryButton} sm:w-auto sm:px-6`}>
          {t("save")}
        </button>
      </form>

      <section className="rounded-3xl border border-border bg-surface p-6">
        <h2 className="text-2xl">{t("password.title")}</h2>
        <p className="mt-1 text-sm text-foreground-secondary">{t("password.subtitle")}</p>
        {user.googleId && !user.emailVerifiedAt ? null : null}
        <form onSubmit={savePassword} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-foreground">
              {t("password.current")}
              <input name="currentPassword" type="password" autoComplete="current-password" required className={`${authField} mt-1.5`} />
            </label>
            <label className="block text-sm font-medium text-foreground">
              {t("password.new")}
              <input name="newPassword" type="password" autoComplete="new-password" required minLength={8} className={`${authField} mt-1.5`} />
            </label>
          </div>
          {passwordError && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
              {passwordError}
            </p>
          )}
          <p className="text-xs text-foreground-muted">{user.googleId ? t("password.googleOnly") : null}</p>
          <button type="submit" disabled={savingPassword} className={`${authPrimaryButton} sm:w-auto sm:px-6`}>
            {t("password.submit")}
          </button>
        </form>
      </section>
    </div>
  );
}
