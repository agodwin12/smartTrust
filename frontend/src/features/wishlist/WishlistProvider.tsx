"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import type { Product, ServerWishlistItem, WishlistItem } from "@/types";

const STORAGE_KEY = "sm:wishlist";
const EMPTY: WishlistItem[] = [];

type WishlistContextValue = {
  items: WishlistItem[];
  hydrated: boolean;
  count: number;
  has: (id: string) => boolean;
  /** Returns true when the item was added, false when removed. */
  toggle: (item: WishlistItem) => boolean;
  remove: (id: string) => void;
  clear: () => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export const toWishlistItem = (product: Product): WishlistItem => ({
  id: product.id,
  slug: product.slug,
  title: product.title,
  price: product.price,
  image: product.images?.[0] ?? null,
  storeName: product.store?.name ?? "",
});

/**
 * The device's localStorage is the cache everyone reads from; when the visitor is
 * signed in it is kept in sync with the account's server-side list: the local
 * items are merged into the account at sign-in, and every toggle is mirrored to
 * the API (fire-and-forget — the UI never waits on it).
 */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems, hydrated] = useLocalStorageState<WishlistItem[]>(STORAGE_KEY, EMPTY);
  const { status, user, authFetch } = useAuth();
  const syncedFor = useRef<string | null>(null);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const isAuthed = status === "authenticated" && !!user;

  // Sign-in merge: local ids → account, then adopt the account's list.
  useEffect(() => {
    if (!isAuthed || !hydrated || syncedFor.current === user.id) return;
    syncedFor.current = user.id;
    authFetch<{ items: ServerWishlistItem[] }>("wishlist/merge", {
      method: "POST",
      body: { advertisementIds: itemsRef.current.map((i) => i.id) },
    })
      .then(({ items: serverItems }) => setItems(serverItems.map((row) => toWishlistItem(row.advertisement))))
      .catch(() => {
        syncedFor.current = null; // try again on the next render cycle
      });
  }, [isAuthed, hydrated, user?.id, authFetch, setItems, user]);

  useEffect(() => {
    if (status === "anonymous") syncedFor.current = null;
  }, [status]);

  const mirror = useCallback(
    (id: string, add: boolean) => {
      if (!isAuthed) return;
      authFetch(`wishlist/${encodeURIComponent(id)}`, { method: add ? "PUT" : "DELETE" }).catch(() => {
        /* offline / transient — the local list stays the source of truth on this device */
      });
    },
    [isAuthed, authFetch]
  );

  const toggle = useCallback<WishlistContextValue["toggle"]>(
    (item) => {
      const exists = itemsRef.current.some((i) => i.id === item.id);
      setItems((prev) => (exists ? prev.filter((i) => i.id !== item.id) : [item, ...prev]));
      mirror(item.id, !exists);
      return !exists;
    },
    [setItems, mirror]
  );
  const remove = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((i) => i.id !== id));
      mirror(id, false);
    },
    [setItems, mirror]
  );
  const clear = useCallback(() => {
    itemsRef.current.forEach((i) => mirror(i.id, false));
    setItems(EMPTY);
  }, [setItems, mirror]);

  const value = useMemo<WishlistContextValue>(
    () => ({ items, hydrated, count: items.length, has: (id) => items.some((i) => i.id === id), toggle, remove, clear }),
    [items, hydrated, toggle, remove, clear]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used inside <WishlistProvider>");
  return ctx;
}
