import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

// Next 16 calls this file "proxy" (formerly middleware). It only does locale
// detection/redirects; auth guards will be added here once the auth pages exist.
export const proxy = createMiddleware(routing);

export const config = {
  // Skip Next internals, API/metadata routes, the service worker and any file with an extension.
  matcher: ["/((?!api|healthz|_next|_vercel|sw\\.js|manifest\\.webmanifest|.*\\..*).*)"],
};
