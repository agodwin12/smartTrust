"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { readKey, subscribeKey, writeKey } from "@/lib/local-store";

const getServerSnapshot = () => null;
const noopSubscribe = () => () => {};

function parse<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * JSON state persisted in localStorage. Renders `initialValue` on the server and
 * during hydration, then the stored value — no mismatch, no flash of wrong data.
 * Returns [value, setValue, hydrated].
 */
export function useLocalStorageState<T>(key: string, initialValue: T) {
  const raw = useSyncExternalStore(
    useCallback((cb: () => void) => subscribeKey(key, cb), [key]),
    () => readKey(key),
    getServerSnapshot
  );
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  const value = useMemo<T>(() => parse(raw, initialValue), [raw, initialValue]);

  const setValue = useCallback(
    (updater: T | ((prev: T) => T)) => {
      const current = parse(readKey(key), initialValue);
      const next = typeof updater === "function" ? (updater as (prev: T) => T)(current) : updater;
      writeKey(key, JSON.stringify(next));
    },
    [key, initialValue]
  );

  return [value, setValue, hydrated] as const;
}
