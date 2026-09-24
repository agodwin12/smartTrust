/*
 * A tiny external store over localStorage so React can read it through
 * useSyncExternalStore: hydration-safe (server snapshot is null), cross-tab
 * (listens to the storage event) and resilient to private mode / quota errors.
 */
type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();
const cache = new Map<string, string | null>();
let storageListenerAttached = false;

function attachStorageListener() {
  if (storageListenerAttached || typeof window === "undefined") return;
  storageListenerAttached = true;
  window.addEventListener("storage", (event) => {
    if (!event.key) return;
    cache.set(event.key, event.newValue);
    listeners.get(event.key)?.forEach((cb) => cb());
  });
}

export function readKey(key: string): string | null {
  if (typeof window === "undefined") return null;
  if (!cache.has(key)) {
    try {
      cache.set(key, window.localStorage.getItem(key));
    } catch {
      cache.set(key, null);
    }
  }
  return cache.get(key) ?? null;
}

export function writeKey(key: string, value: string | null) {
  cache.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — keep the in-memory value for this session */
  }
  listeners.get(key)?.forEach((cb) => cb());
}

export function subscribeKey(key: string, callback: Listener) {
  attachStorageListener();
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(callback);
  return () => {
    listeners.get(key)?.delete(callback);
  };
}
