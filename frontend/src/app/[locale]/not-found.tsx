import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";

export default async function NotFound() {
  const t = await getTranslations("errors.notFound");

  return (
    <PageShell>
      <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-brand-sky/70 text-brand-blue dark:bg-surface-elevated dark:text-brand-blue-light">
          <SearchX className="size-8" />
        </span>
        <p className="mt-6 font-display text-7xl text-brand-blue dark:text-brand-blue-light">404</p>
        <h1 className="mt-2 text-3xl">{t("title")}</h1>
        <p className="mt-2 max-w-md text-foreground-secondary">{t("description")}</p>
        <Link href="/" className="mt-8 inline-flex h-12 items-center rounded-xl bg-brand-orange px-6 text-sm font-semibold text-white hover:bg-brand-orange-light">
          {t("action")}
        </Link>
      </Container>
    </PageShell>
  );
}
