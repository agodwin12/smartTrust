"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { useRouter } from "@/i18n/navigation";

/** Signs out everywhere (the API revokes every token of the account), then returns home. */
export function useSignOut() {
  const { logout } = useAuth();
  const router = useRouter();
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);

  const signOut = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      await logout();
      toast.success(t("signedOut"));
      router.replace("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }, [pending, logout, router, t]);

  return { signOut, pending };
}
