"use client";

import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useCart } from "@/features/cart/CartProvider";
import { useWishlist } from "@/features/wishlist/WishlistProvider";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/format";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHero } from "@/components/ui/PageHero";

export function WishlistView() {
  const t = useTranslations("wishlist");
  const tp = useTranslations("products");
  const locale = useLocale();
  const wishlist = useWishlist();
  const cart = useCart();

  return (
    <>
      <PageHero title={t("title")} subtitle={t("subtitle")} size="compact" />
      <Container className="py-8 sm:py-12">
        {wishlist.hydrated && wishlist.items.length === 0 ? (
          <EmptyState icon={Heart} title={t("empty.title")} description={t("empty.description")} action={{ label: t("empty.action"), href: "/products" }} />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {wishlist.items.map((item) => (
              <li key={item.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
                <Link href={`/products/${item.slug}`} className="relative aspect-[4/3] bg-surface-hover">
                  {item.image && <Image src={item.image} alt={item.title} fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" />}
                </Link>
                <div className="flex flex-1 flex-col gap-1 p-3.5">
                  <Link href={`/products/${item.slug}`} className="line-clamp-2 text-sm font-semibold text-foreground hover:text-brand-blue">
                    {item.title}
                  </Link>
                  <p className="text-xs text-foreground-muted">{item.storeName}</p>
                  <p className="font-script text-lg text-brand-blue dark:text-brand-blue-light">{formatPrice(item.price, locale)}</p>
                  <div className="mt-auto flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        cart.add(item);
                        toast.success(tp("addedToCart"), { description: item.title });
                      }}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-orange text-xs font-semibold text-white hover:bg-brand-orange-light"
                    >
                      <ShoppingCart className="size-3.5" /> {t("addToCart")}
                    </button>
                    <button type="button" onClick={() => wishlist.remove(item.id)} aria-label={t("remove")} className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-foreground-muted hover:text-danger">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
