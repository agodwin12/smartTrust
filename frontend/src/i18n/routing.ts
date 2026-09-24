import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fr"],
  defaultLocale: "en",
  // English lives at "/", French at "/fr/..." — clean URLs for the default market, SEO-friendly for both.
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];
