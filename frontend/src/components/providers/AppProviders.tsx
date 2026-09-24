"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { CartProvider } from "@/features/cart/CartProvider";
import { WishlistProvider } from "@/features/wishlist/WishlistProvider";
import { Toaster } from "@/components/ui/sonner";

/** Client-side state that every page shares. Theme + i18n providers stay in the (server) layout. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          {children}
          <Toaster position="bottom-center" closeButton richColors />
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}
