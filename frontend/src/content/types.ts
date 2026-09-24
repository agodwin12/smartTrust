import type { PageContent } from "@/components/content/ContentPage";

export type Locale = "en" | "fr";
export type Localized<T> = Record<Locale, T>;

/** Resolve a bilingual content object for the current locale (falls back to English). */
export const pick = <T>(content: Localized<T>, locale: string): T => content[locale === "fr" ? "fr" : "en"];

export type { PageContent };
