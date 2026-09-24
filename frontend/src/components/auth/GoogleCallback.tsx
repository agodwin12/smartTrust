"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link, useRouter } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api";
import type { User } from "@/types";
import { AuthCard, authPrimaryButton } from "@/components/auth/AuthCard";

/**
 * Landing page for the API's Google OAuth redirect. The access token travels in the URL
 * fragment (never sent to any server); the refresh cookie was already set by the API.
 */
export function GoogleCallback() {
  const t = useTranslations("auth.callback");
  const ta = useTranslations("auth");
  const { setSession } = useAuth();
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("accessToken");
    const error = new URLSearchParams(window.location.search).get("error");

    if (!accessToken || error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the OAuth result only exists in the URL after mount
      setFailed(true);
      return;
    }

    // Drop the token from the address bar before anything else can read it.
    window.history.replaceState(null, "", window.location.pathname);

    apiFetch<{ user: User }>("users/me", { token: accessToken })
      .then(({ user }) => {
        setSession({ user, accessToken });
        toast.success(ta("welcome", { name: user.firstName }));
        router.replace("/");
      })
      .catch(() => setFailed(true));
  }, [router, setSession, ta]);

  if (failed) {
    return (
      <AuthCard title={t("error")}>
        <Link href="/login" className={authPrimaryButton}>
          {t("retry")}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("loading")}>
      <Loader2 className="mx-auto size-8 animate-spin text-brand-blue" />
    </AuthCard>
  );
}
