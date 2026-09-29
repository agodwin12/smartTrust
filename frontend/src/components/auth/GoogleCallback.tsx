"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link, useRouter } from "@/i18n/navigation";
import { AuthCard, authPrimaryButton } from "@/components/auth/AuthCard";

/**
 * Landing page for the API's Google OAuth redirect. No token travels in the URL: the API set
 * the httpOnly refresh cookie, and this page exchanges it for an in-memory access token.
 */
export function GoogleCallback() {
  const t = useTranslations("auth.callback");
  const ta = useTranslations("auth");
  const { restoreSession } = useAuth();
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const error = query.get("error");

    if (error || query.get("status") !== "ok") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the OAuth result only exists in the URL after mount
      setFailed(true);
      return;
    }

    window.history.replaceState(null, "", window.location.pathname);

    restoreSession()
      .then((user) => {
        if (!user) return setFailed(true);
        toast.success(ta("welcome", { name: user.firstName }));
        router.replace("/");
      })
      .catch(() => setFailed(true));
  }, [router, restoreSession, ta]);

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
