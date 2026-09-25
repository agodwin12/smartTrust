"use client";

import { ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/** The WhatsApp glyph (brand mark, drawn inline so no external asset is loaded). */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="currentColor">
      <path d="M16.004 3C8.832 3 3 8.83 3 16c0 2.29.6 4.53 1.74 6.5L3 29l6.68-1.75A12.96 12.96 0 0 0 16 29c7.17 0 13-5.83 13-13S23.176 3 16.004 3Zm0 23.63c-1.98 0-3.92-.53-5.62-1.54l-.4-.24-3.96 1.04 1.06-3.86-.26-.4A10.6 10.6 0 0 1 5.37 16c0-5.86 4.77-10.63 10.64-10.63 5.86 0 10.62 4.77 10.62 10.63 0 5.87-4.77 10.63-10.63 10.63Zm5.83-7.96c-.32-.16-1.89-.93-2.18-1.04-.3-.1-.51-.16-.72.16-.21.32-.83 1.04-1.01 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.9-1.78-2.22-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.1-.21.05-.4-.03-.56-.08-.16-.72-1.73-.99-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66 0 1.57 1.14 3.09 1.3 3.3.16.21 2.25 3.43 5.45 4.81.76.33 1.35.52 1.81.67.76.24 1.46.21 2 .13.61-.09 1.89-.77 2.16-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z" />
    </svg>
  );
}

/**
 * Site-wide floating controls: the WhatsApp bubble bottom-left (only when a number is
 * configured on the server) and a back-to-top arrow bottom-right, above the chat launcher.
 */
export function FloatingWidgets({ whatsappUrl }: { whatsappUrl: string | null }) {
  const t = useTranslations("widgets");
  const reduceMotion = useReducedMotion();
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toTop = () => window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });

  return (
    <>
      {whatsappUrl && (
        <a
          href={`${whatsappUrl}?text=${encodeURIComponent(t("whatsappMessage"))}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("whatsapp")}
          title={t("whatsapp")}
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-4 z-40 inline-flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_16px_32px_-12px_rgba(37,211,102,0.7)] transition-transform hover:scale-105 active:scale-95 lg:bottom-5 lg:left-5"
        >
          <WhatsAppGlyph className="size-7" />
        </a>
      )}

      <AnimatePresence>
        {showTop && (
          <motion.button
            key="to-top"
            type="button"
            onClick={toTop}
            aria-label={t("backToTop")}
            title={t("backToTop")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-[calc(8.75rem+env(safe-area-inset-bottom))] right-[1.375rem] z-40 inline-flex size-11 items-center justify-center rounded-full border border-market-border bg-market-surface text-market-navy shadow-[0_10px_24px_-10px_rgba(8,45,97,0.45)] transition-colors hover:bg-market-orange hover:text-white lg:bottom-[5.75rem] lg:right-[1.625rem]"
          >
            <ArrowUp className="size-5" aria-hidden />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
