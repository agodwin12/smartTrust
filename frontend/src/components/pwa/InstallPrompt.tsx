"use client";

import { Download, Share, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "sm:install-dismissed-at";
const DISMISS_DAYS = 14;
const SHOW_DELAY_MS = 3500;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * First-visit "install the app" recommendation.
 *  - Chromium (Android / desktop): captures `beforeinstallprompt` and triggers the native prompt.
 *  - iOS Safari: no install API, so we show the Share → "Add to Home Screen" hint instead.
 * Never shown when already running as an installed app, and snoozed for 14 days once dismissed.
 */
export function InstallPrompt() {
  const t = useTranslations("pwa");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "native" | "ios">("hidden");

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    let timer: number | undefined;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      timer = window.setTimeout(() => setMode("native"), SHOW_DELAY_MS);
    };
    const onInstalled = () => setMode("hidden");

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    if (isIos()) {
      timer = window.setTimeout(() => setMode("ios"), SHOW_DELAY_MS);
    }

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode — fine, we just show it again next visit */
    }
    setMode("hidden");
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setMode("hidden");
    else dismiss();
  };

  return (
    <AnimatePresence>
      {mode !== "hidden" && (
        <motion.aside
          key="install"
          role="complementary"
          aria-label={t("title")}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-x-3 bottom-24 z-40 rounded-2xl border border-border bg-surface-elevated p-4 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.45)] sm:inset-x-auto sm:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:left-5 sm:w-[380px] lg:bottom-5"
        >
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("close")}
            className="absolute right-2.5 top-2.5 inline-flex size-8 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-hover hover:text-foreground"
          >
            <X className="size-4" />
          </button>
          <div className="flex items-start gap-3 pr-6">
            <Image src="/icons/icon-192.png" alt="" width={48} height={48} className="size-12 shrink-0 rounded-xl border border-border bg-background" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{t("title")}</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground-secondary">{t("description")}</p>
              {mode === "ios" && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-foreground-muted">
                  <Share className="mt-0.5 size-3.5 shrink-0 text-brand-blue" />
                  {t("iosHint")}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {mode === "native" && (
              <button
                type="button"
                onClick={install}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-blue text-sm font-semibold text-white transition-colors hover:bg-brand-blue-light"
              >
                <Download className="size-4" />
                {t("install")}
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-border text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover"
            >
              {t("later")}
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
