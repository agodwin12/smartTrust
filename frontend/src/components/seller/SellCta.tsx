"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";

/** Primary "start selling" action — its destination depends on whether the visitor is signed in. */
export function SellCta({ secondaryHref = "/subscriptions" }: { secondaryHref?: string }) {
  const t = useTranslations("sell");
  const { status, user } = useAuth();
  const ts = useTranslations("sellerArea");
  const href = status === "authenticated" ? (user?.store ? "/seller" : "/seller/onboarding") : "/register?next=%2Fseller%2Fonboarding";

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link
        href={href}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-orange px-6 text-sm font-semibold text-white shadow-[0_10px_28px_-12px_var(--brand-orange)] transition-[background-color,transform] hover:bg-brand-orange-light active:scale-[0.98]"
      >
        {status === "authenticated" ? (user?.store ? ts("title") : t("cta")) : t("ctaLoggedOut")}
        <ArrowRight className="size-4" />
      </Link>
      <Link
        href={secondaryHref}
        className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-surface px-6 text-sm font-semibold text-foreground transition-colors hover:border-brand-blue hover:text-brand-blue"
      >
        {t("secondary")}
      </Link>
    </div>
  );
}
