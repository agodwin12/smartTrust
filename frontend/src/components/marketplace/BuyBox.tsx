"use client";

import { BadgeCheck, Banknote, Heart, Minus, Plus, ShieldCheck, ShoppingCart, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { toCartItem, useCart } from "@/features/cart/CartProvider";
import { toWishlistItem, useWishlist } from "@/features/wishlist/WishlistProvider";
import { Link, useRouter } from "@/i18n/navigation";
import { discountPercent, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product, Store as StoreModel } from "@/types";
import { RatingStars } from "@/components/marketplace/RatingStars";

/** Price, quantity and the three purchase actions for the product page. */
export function BuyBox({ product, store }: { product: Product; store?: StoreModel | null }) {
  const t = useTranslations("product");
  const tp = useTranslations("products");
  const locale = useLocale();
  const router = useRouter();
  const cart = useCart();
  const wishlist = useWishlist();
  const [quantity, setQuantity] = useState(1);

  const discount = discountPercent(product.price, product.compareAtPrice);
  const inCart = cart.has(product.id);
  const wished = wishlist.has(product.id);

  const addToCart = () => {
    cart.add(toCartItem(product), quantity);
    toast.success(tp("addedToCart"), { description: product.title });
  };
  const toggleWishlist = () => {
    const added = wishlist.toggle(toWishlistItem(product));
    toast(added ? tp("addedToWishlist") : tp("removedFromWishlist"));
  };
  const buyNow = () => router.push(`/checkout/${product.slug}?qty=${quantity}`);

  return (
    <aside className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <p className="font-bold text-4xl leading-none text-brand-blue dark:text-brand-blue-light">{formatPrice(product.price, locale)}</p>
        {product.compareAtPrice && (
          <p className="text-sm text-foreground-muted">
            <span className="line-through">{formatPrice(product.compareAtPrice, locale)}</span>
            {discount !== null && <span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">{tp("save", { percent: discount })}</span>}
          </p>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wider text-foreground-muted">{t("condition")}</dt>
          <dd className="font-medium text-foreground">{tp(`condition.${product.condition}`)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-foreground-muted">{t("location")}</dt>
          <dd className="font-medium text-foreground">{product.location ?? "—"}</dd>
        </div>
      </dl>

      <div className="mt-5 flex items-center gap-3">
        <span className="text-sm font-medium text-foreground-secondary">{t("quantity")}</span>
        <div className="inline-flex h-11 items-center rounded-xl border border-border">
          <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="−" className="inline-flex size-11 items-center justify-center text-foreground-secondary hover:text-foreground">
            <Minus className="size-4" />
          </button>
          <span className="w-8 text-center text-sm font-semibold text-foreground">{quantity}</span>
          <button type="button" onClick={() => setQuantity((q) => Math.min(99, q + 1))} aria-label="+" className="inline-flex size-11 items-center justify-center text-foreground-secondary hover:text-foreground">
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={buyNow}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-orange text-sm font-semibold text-white shadow-[0_10px_28px_-12px_var(--brand-orange)] transition-[background-color,transform] hover:bg-brand-orange-light active:scale-[0.98]"
        >
          <ShieldCheck className="size-4" /> {t("buyNow")}
        </button>
        <div className="grid grid-cols-[1fr_auto] gap-2.5">
          <button
            type="button"
            onClick={addToCart}
            className={cn(
              "inline-flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors",
              inCart ? "border-brand-blue bg-brand-sky/50 text-brand-blue dark:bg-surface-hover dark:text-brand-blue-light" : "border-border text-foreground hover:border-brand-blue hover:text-brand-blue"
            )}
          >
            <ShoppingCart className="size-4" /> {inCart ? t("inCart") : tp("addToCart")}
          </button>
          <button
            type="button"
            onClick={toggleWishlist}
            aria-pressed={wished}
            aria-label={tp("addToWishlist")}
            className="inline-flex size-12 items-center justify-center rounded-xl border border-border text-foreground-secondary transition-colors hover:border-danger hover:text-danger"
          >
            <Heart className={cn("size-5", wished && "fill-danger text-danger")} />
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-brand-sky/50 p-4 text-sm dark:bg-surface-elevated">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <ShieldCheck className="size-4 text-brand-blue dark:text-brand-blue-light" /> {t("escrow.title")}
        </p>
        <ul className="mt-2 space-y-1.5 text-foreground-secondary">
          <li>· {t("escrow.point1")}</li>
          <li>· {t("escrow.point2")}</li>
          <li>· {t("escrow.point3")}</li>
        </ul>
        {(store?.acceptsCashOnDelivery ?? product.store.acceptsCashOnDelivery) !== false && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
            <Banknote className="size-4" /> {t("cod")}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-foreground-muted">{t("soldBy")}</p>
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
            {product.store.name}
            <BadgeCheck className="size-4 shrink-0 text-brand-blue" />
          </p>
          {typeof store?.rating === "number" && <RatingStars rating={store.rating} count={store.reviewCount} />}
        </div>
        <Link
          href={`/stores/${product.store.slug}`}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:border-brand-blue hover:text-brand-blue"
        >
          <Store className="size-4" /> {t("viewStore")}
        </Link>
      </div>
    </aside>
  );
}
