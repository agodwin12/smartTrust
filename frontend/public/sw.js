/* Smart Market service worker.
 *
 * Deliberately conservative so it can never serve stale application code:
 *   - images, fonts and PWA icons  → stale-while-revalidate (fast repeat visits, no re-downloads)
 *   - everything else (HTML, JS, CSS, API) → network only (never intercepted)
 * Bump CACHE_VERSION to drop every old cache on the next activation.
 */
const CACHE_VERSION = "v1";
const ASSET_CACHE = `sm-assets-${CACHE_VERSION}`;
const MAX_ASSET_ENTRIES = 200;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== ASSET_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isCacheableAsset(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // Remote product photography (R2 / Unsplash) — safe to cache, immutable by URL.
    return request.destination === "image";
  }
  if (request.destination === "image" || request.destination === "font") return true;
  return url.pathname.startsWith("/icons/") || url.pathname.startsWith("/_next/image");
}

async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ASSET_ENTRIES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_ASSET_ENTRIES).map((k) => cache.delete(k)));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!isCacheableAsset(request)) return;

  event.respondWith(
    caches.open(ASSET_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && (response.ok || response.type === "opaque")) {
            cache.put(request, response.clone()).then(() => trimCache(cache));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
