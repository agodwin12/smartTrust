import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { VerifyEmailForm } from "@/components/auth/VerifyEmailForm";
import { PageShell } from "@/components/layout/PageShell";
import { seo } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return seo(locale, "/verify-email", { title: t("verify.title"), robots: { index: false } }, { noIndex: true });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <PageShell>
      <Suspense fallback={null}>
        <VerifyEmailForm />
      </Suspense>
    </PageShell>
  );
}
