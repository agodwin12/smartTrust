import { BadgeCheck, CalendarDays, Mail, MapPin, Phone } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { formatDate, initials } from "@/lib/format";
import { RatingStars } from "@/components/marketplace/RatingStars";
import type { Store } from "@/types";

/** Store page masthead: banner, logo (or initials), name, location, member-since and tap-to-contact buttons. */
export async function StoreHeader({ store, listingCount }: { store: Store; listingCount: number }) {
  const t = await getTranslations("stores");
  const locale = await getLocale();

  const button = "inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-sm font-semibold text-foreground transition-colors hover:border-brand-blue hover:text-brand-blue";

  return (
    <section className="border-b border-border bg-surface">
      <div className="relative h-40 w-full overflow-hidden bg-brand-sky/60 sm:h-56 dark:bg-surface-elevated">
        {store.bannerUrl && <Image src={store.bannerUrl} alt="" fill priority sizes="100vw" className="object-cover" />}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(7,11,18,0.55),transparent_60%)]" />
      </div>
      <Container className="pb-6">
        <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:gap-6">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-3xl border-4 border-surface bg-brand-sky/70 shadow-lg sm:size-28 dark:bg-surface-elevated">
            {store.logoUrl ? (
              <Image src={store.logoUrl} alt={store.name} fill sizes="112px" className="object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center font-display text-3xl text-brand-blue dark:text-brand-blue-light">{initials(store.name)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 text-3xl sm:text-4xl">
              {store.name}
              <BadgeCheck className="size-6 text-brand-blue" aria-label={t("verified")} />
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground-secondary">
              {store.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" /> {store.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" /> {t("memberSince", { date: formatDate(store.createdAt, locale, { month: "long", year: "numeric" }) })}
              </span>
              <span>{t("listings", { count: listingCount })}</span>
              {typeof store.rating === "number" && <RatingStars rating={store.rating} count={store.reviewCount} />}
            </p>
          </div>
          {(store.contactPhone || store.contactEmail) && (
            <div className="flex flex-wrap gap-2">
              {store.contactPhone && (
                <a href={`tel:${store.contactPhone}`} className={button}>
                  <Phone className="size-4" /> {t("call")}
                </a>
              )}
              {store.contactEmail && (
                <a href={`mailto:${store.contactEmail}`} className={button}>
                  <Mail className="size-4" /> {t("email")}
                </a>
              )}
            </div>
          )}
        </div>
        {store.description && (
          <div className="mt-5 max-w-3xl">
            <h2 className="font-sans text-sm font-semibold uppercase tracking-wider text-foreground-muted">{t("about", { name: store.name })}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground-secondary sm:text-base">{store.description}</p>
          </div>
        )}
      </Container>
    </section>
  );
}
