"use client";

import { useEffect } from "react";

const ENABLED = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SW_DEV === "true";

/** Registers /sw.js (asset caching only). Off in development unless NEXT_PUBLIC_SW_DEV=true. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!ENABLED || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.warn("[pwa] service worker registration failed", error);
    });
  }, []);

  return null;
}
