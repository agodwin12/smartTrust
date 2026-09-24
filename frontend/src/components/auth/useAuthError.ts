"use client";

import { useTranslations } from "next-intl";
import { ApiRequestError } from "@/lib/api";

/** Maps an API error code to a translated, user-facing sentence. */
export function useAuthError() {
  const t = useTranslations("auth.errors");
  return (error: unknown): string => {
    if (error instanceof ApiRequestError) {
      if (error.status === 429) return t("RATE_LIMITED");
      if (t.has(error.code)) return t(error.code);
      if (error.status < 500 && error.message) return error.message;
    }
    return t("generic");
  };
}
