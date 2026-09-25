"use client";

import { ShoppingCart } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { toCartItem, useCart } from "@/features/cart/CartProvider";
import { Link } from "@/i18n/navigation";
import { discountPercent, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

/** Compact deal tile (design guide §13): badge, photo, title, condition, red price, old price, cart button. */
type DealCardProps = { product: Product; className?: string; /** "deal" = red price (flash rail); "catalog" = ink price, taller photo. */ tone?: "deal" | "catalog" };

export function DealCard({ product, className, tone = "deal" }: DealCardProps) {
  const t = useTranslations("products");
  const locale = useLocale();
  const cart = useCart();

  const discount = discountPercent(product.price, product.compareAtPrice);
  const image = product.images?.[0];
  const href = `/products/${product.slug}`;

  const onAddToCart = () => {
    cart.add(toCartItem(product));
    toast.success(t("addedToCart"), { description: product.title });
  };

  return (
    <article className={cn("market-card relative flex h-full flex-col p-2", className)}>
      {discount !== null && (
        <span className="absolute left-2 top-2 z-10 rounded-[5px] bg-market-red px-1.5 py-0.5 text-[10px] font-extrabold leading-tight text-white">-{discount}%</span>
      )}
      <Link href={href} tabIndex={-1} aria-hidden className={cn("relative block overflow-hidden rounded-[6px] bg-market-blue-light/60", tone === "catalog" ? "h-[140px] sm:h-[130px]" : "h-[132px] sm:h-[110px] lg:h-[100px]")}>
        {image && <Image src={image} alt="" fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px" loading="lazy" className="object-cover" />}
      </Link>
      <Link href={href} className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug text-market-ink transition-colors hover:text-market-blue sm:line-clamp-1 sm:text-[12px] sm:leading-tight">
        {product.title}
      </Link>
      <p className="text-[10px] text-market-muted">({t(`condition.${product.condition}`)})</p>
      <div className="mt-auto flex items-end justify-between gap-1 pt-1.5">
        <div className="min-w-0">
          <p className={cn("truncate text-[15px] font-extrabold leading-none sm:text-[13px]", tone === "catalog" ? "text-market-ink" : "text-market-red")}>{formatPrice(product.price, locale)}</p>
          {product.compareAtPrice && <p className="mt-0.5 truncate text-[10px] text-market-muted line-through">{formatPrice(product.compareAtPrice, locale)}</p>}
        </div>
        <button
          type="button"
          onClick={onAddToCart}
          aria-label={t("addToCart")}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-[6px] bg-market-orange text-white transition-[background-color,transform] hover:bg-market-orange-dark active:scale-95"
        >
          <ShoppingCart className="size-3.5" aria-hidden />
        </button>
      </div>
    </article>
  );
}
