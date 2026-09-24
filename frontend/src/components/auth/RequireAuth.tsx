"use client";

import { LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link, usePathname } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";

/** Gate for account pages: skeleton while the session is restored, a sign-in card when anonymous. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const t = useTranslations("auth.requireLogin");
  const { status } = useAuth();
  const pathname = usePathname();
  const next = encodeURIComponent(pathname);

  if (status === "loading") {
    return (
      <Container className="py-16">
        <div className="mx-auto max-w-2xl space-y-3">
          <div className="h-8 w-1/2 animate-pulse rounded-lg bg-surface-hover" />
          <div className="h-24 animate-pulse rounded-2xl bg-surface-hover" />
          <div className="h-24 animate-pulse rounded-2xl bg-surface-hover" />
        </div>
      </Container>
    );
  }

  if (status === "anonymous") {
    return (
      <Container className="flex flex-1 items-center justify-center py-16">
        <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 text-center">
          <span className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-brand-sky/70 text-brand-blue dark:bg-surface-elevated dark:text-brand-blue-light">
            <LogIn className="size-6" />
          </span>
          <h1 className="mt-4 text-2xl text-foreground">{t("title")}</h1>
          <p className="mt-2 text-sm text-foreground-secondary">{t("description")}</p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href={`/login?next=${next}`} className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-blue text-sm font-semibold text-white hover:bg-brand-blue-light">
              {t("login")}
            </Link>
            <Link href={`/register?next=${next}`} className="inline-flex h-11 items-center justify-center rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-surface-hover">
              {t("register")}
            </Link>
          </div>
        </div>
      </Container>
    );
  }

  return <>{children}</>;
}
