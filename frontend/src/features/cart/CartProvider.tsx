"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import type { CartItem, Product } from "@/types";

const STORAGE_KEY = "sm:cart";
const EMPTY: CartItem[] = [];

type CartContextValue = {
  items: CartItem[];
  hydrated: boolean;
  count: number;
  subtotal: number;
  has: (id: string) => boolean;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export const toCartItem = (product: Product): Omit<CartItem, "quantity"> => ({
  id: product.id,
  slug: product.slug,
  title: product.title,
  price: product.price,
  image: product.images?.[0] ?? null,
  storeName: product.store?.name ?? "",
});

/** Client-side cart: every listing is bought through its own escrow order, so the cart is a shortlist you check out item by item. */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems, hydrated] = useLocalStorageState<CartItem[]>(STORAGE_KEY, EMPTY);

  const add = useCallback<CartContextValue["add"]>(
    (item, quantity = 1) =>
      setItems((prev) => {
        const existing = prev.find((p) => p.id === item.id);
        if (existing) return prev.map((p) => (p.id === item.id ? { ...p, quantity: Math.min(p.quantity + quantity, 99) } : p));
        return [...prev, { ...item, quantity }];
      }),
    [setItems]
  );
  const setQuantity = useCallback<CartContextValue["setQuantity"]>(
    (id, quantity) => setItems((prev) => prev.map((p) => (p.id === id ? { ...p, quantity: Math.max(1, Math.min(quantity, 99)) } : p))),
    [setItems]
  );
  const remove = useCallback((id: string) => setItems((prev) => prev.filter((p) => p.id !== id)), [setItems]);
  const clear = useCallback(() => setItems(EMPTY), [setItems]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      hydrated,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((n, i) => n + Number(i.price) * i.quantity, 0),
      has: (id) => items.some((i) => i.id === id),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [items, hydrated, add, setQuantity, remove, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
