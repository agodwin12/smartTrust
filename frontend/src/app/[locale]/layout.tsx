import type { Metadata, Viewport } from "next";
import { Changa_One, Inter, Lobster_Two, Montserrat, Satisfy, Share_Tech } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { routing } from "@/i18n/routing";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AppProviders } from "@/components/providers/AppProviders";
import { ChatLauncher } from "@/components/chatbot/ChatLauncher";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import "../globals.css";
import { SITE_URL } from "@/lib/seo";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"] });
const shareTech = Share_Tech({ variable: "--font-share-tech", subsets: ["latin"], weight: "400" });
const satisfy = Satisfy({ variable: "--font-satisfy", subsets: ["latin"], weight: "400" });
const changaOne = Changa_One({ variable: "--font-changa-one", subsets: ["latin"], weight: "400" });
const lobsterTwo = Lobster_Two({ variable: "--font-lobster-two", subsets: ["latin"], weight: ["400", "700"] });

const fontClassName = [inter, montserrat, shareTech, satisfy, changaOne, lobsterTwo].map((f) => f.variable).join(" ");

type Params = Promise<{ locale: string }>;

// Every page under /[locale] shows live marketplace data, so nothing is prerendered at build
// time: `next build` must succeed without a reachable API (inside the Docker image there is
// none). Pages render per request; the catalog fetchers keep their own revalidate windows.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hero" });

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `Smart Market — ${t("slides.marketplace.titleLine1")} ${t("slides.marketplace.titleLine3")}`,
      template: "%s · Smart Market",
    },
    description: t("slides.marketplace.description"),
    applicationName: "Smart Market",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default", title: "Smart Market" },
    icons: { icon: "/icons/icon-192.png", apple: "/apple-touch-icon.png" },
    openGraph: { type: "website", siteName: "Smart Market", locale },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#082D61" },
    { media: "(prefers-color-scheme: dark)", color: "#070B12" },
  ],
};

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Params }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} suppressHydrationWarning className={`${fontClassName} h-full`}>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <NextIntlClientProvider>
            <AppProviders>
              {children}
              <ChatLauncher />
              <InstallPrompt />
              <ServiceWorkerRegister />
            </AppProviders>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
