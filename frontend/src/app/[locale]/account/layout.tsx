import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { AccountNav } from "@/components/account/AccountNav";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";

/** Every /account page: sign-in gate, section navigation, content column. */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("account");

  return (
    <PageShell>
      <RequireAuth>
        <Container className="py-8 sm:py-12">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-brand-orange lg:hidden">{t("title")}</p>
          <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
            <AccountNav />
            <div className="min-w-0">{children}</div>
          </div>
        </Container>
      </RequireAuth>
    </PageShell>
  );
}
