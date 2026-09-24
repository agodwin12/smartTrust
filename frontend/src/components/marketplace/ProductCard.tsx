"use client";

import { Heart, ShoppingCart } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { toCartItem, useCart } from "@/features/cart/CartProvider";
import { toWishlistItem, useWishlist } from "@/features/wishlist/WishlistProvider";
import { Link } from "@/i18n/navigation";
import { discountPercent, formatPrice } from "@/lib/format";
import { motionConfig } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { RatingStars } from "@/components/marketplace/RatingStars";
import type { Product } from "@/types";

type ProductCardProps = {
  product: Product;
  priority?: boolean;
  className?: string;
};

export function ProductCard({ product, priority = false, className }: ProductCardProps) {
  const t = useTranslations("products");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const cart = useCart();
  const wishlist = useWishlist();

  const image = product.images?.[0];
  const isFeatured = !!product.featuredUntil && new Date(product.featuredUntil) > new Date();
  const discount = discountPercent(product.price, product.compareAtPrice);
  const wished = wishlist.has(product.id);
  const href = `/products/${product.slug}`;

  const onAddToCart = () => {
    cart.add(toCartItem(product));
    toast.success(t("addedToCart"), { description: product.title });
  };

  const onToggleWishlist = () => {
    const added = wishlist.toggle(toWishlistItem(product));
    toast(added ? t("addedToWishlist") : t("removedFromWishlist"), { description: product.title });
  };

  return (
    <motion.article
      whileHover={reduceMotion ? undefined : { y: -6 }}
      transition={motionConfig.softSpring}
      className={cn(
        // Spec 15: surface, subtle border, rises on hover, border brightens, shadow grows a little.
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-[border-color,box-shadow] duration-300 hover:border-brand-blue/50 hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)]",
        className
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-hover">
        <Link href={href} className="absolute inset-0" tabIndex={-1} aria-hidden>
          {image && (
            <Image
              src={image}
              alt={product.title}
              fill
              priority={priority}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          )}
        </Link>
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
          {discount !== null && (
            <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">{t("save", { percent: discount })}</span>
          )}
          {isFeatured && (
            <span className="rounded-full bg-brand-orange px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">{t("featured")}</span>
          )}
          {product.condition !== "NEW" && (
            <span className="rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-foreground backdrop-blur">
              {t(`condition.${product.condition}`)}
            </span>
          )}
        </div>
        {/* Cart action lives on the image corner so the price row never has to fight for width. */}
        <button
          type="button"
          onClick={onAddToCart}
          aria-label={t("addToCart")}
          className="absolute bottom-3 right-3 inline-flex size-10 items-center justify-center rounded-full bg-brand-orange text-white shadow-[0_8px_20px_-10px_var(--brand-orange)] transition-[opacity,transform,background-color] hover:bg-brand-orange-light active:scale-90 [@media(hover:hover)]:translate-y-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:translate-y-0 [@media(hover:hover)]:group-focus-within:opacity-100"
        >
          <ShoppingCart className="size-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleWishlist}
        aria-pressed={wished}
        aria-label={t("addToWishlist")}
        className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground-secondary shadow-sm backdrop-blur transition-[color,transform] hover:text-danger active:scale-90"
      >
        <Heart className={cn("size-4 transition-colors", wished && "fill-danger text-danger")} />
      </button>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5 sm:p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-foreground-muted">{product.category?.name}</p>
        <Link href={href} className="line-clamp-2 text-sm font-semibold leading-snug text-foreground hover:text-brand-blue">
          {product.title}
        </Link>
        {product.description && (
          <p className="line-clamp-1 font-script text-base leading-snug text-foreground-secondary">{product.description}</p>
        )}
        <p className="text-xs text-foreground-muted">{t("soldBy", { store: product.store?.name ?? "" })}</p>
        {typeof product.rating === "number" && <RatingStars rating={product.rating} count={product.reviewCount} />}

        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-2">
          <p className="font-script text-lg leading-tight text-brand-blue dark:text-brand-blue-light sm:text-xl">
            {formatPrice(product.price, locale)}
          </p>
          {product.compareAtPrice && (
            <p className="text-xs text-foreground-muted line-through">{formatPrice(product.compareAtPrice, locale)}</p>
          )}
        </div>
      </div>
    </motion.article>
  );
}
