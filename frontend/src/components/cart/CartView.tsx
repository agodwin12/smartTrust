"use client";

import { ArrowRight, Minus, Plus, ShieldCheck, Trash2 } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCart } from "@/features/cart/CartProvider";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/format";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHero } from "@/components/ui/PageHero";

export function CartView() {
  const t = useTranslations("cart");
  const locale = useLocale();
  const cart = useCart();

  return (
    <>
      <PageHero title={t("title")} subtitle={t("subtitle")} size="compact" />
      <Container className="py-8 sm:py-12">
        {cart.hydrated && cart.items.length === 0 ? (
          <EmptyState title={t("empty.title")} description={t("empty.description")} action={{ label: t("empty.action"), href: "/products" }} />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <ul className="space-y-3">
              {cart.items.map((item) => (
                <li key={item.id} className="flex gap-4 rounded-2xl border border-border bg-surface p-3 sm:p-4">
                  <Link href={`/products/${item.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-surface-hover sm:size-28">
                    {item.image && <Image src={item.image} alt={item.title} fill sizes="112px" className="object-cover" />}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={`/products/${item.slug}`} className="line-clamp-2 text-sm font-semibold text-foreground hover:text-brand-blue">
                      {item.title}
                    </Link>
                    <p className="text-xs text-foreground-muted">{item.storeName}</p>
                    <p className="mt-1 font-script text-xl text-brand-blue dark:text-brand-blue-light">{formatPrice(Number(item.price) * item.quantity, locale)}</p>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                      <div className="inline-flex h-9 items-center rounded-lg border border-border">
                        <button type="button" onClick={() => cart.setQuantity(item.id, item.quantity - 1)} className="inline-flex size-9 items-center justify-center text-foreground-secondary" aria-label="-">
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                        <button type="button" onClick={() => cart.setQuantity(item.id, item.quantity + 1)} className="inline-flex size-9 items-center justify-center text-foreground-secondary" aria-label="+">
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => cart.remove(item.id)} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-foreground-muted hover:text-danger">
                          <Trash2 className="size-3.5" /> {t("remove")}
                        </button>
                        <Link href={`/checkout/${item.slug}?qty=${item.quantity}`} className="inline-flex h-9 items-center rounded-lg bg-brand-orange px-3.5 text-xs font-semibold text-white hover:bg-brand-orange-light">
                          {t("checkoutItem")}
                        </Link>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <aside className="h-fit rounded-2xl border border-border bg-surface p-5 lg:sticky lg:top-28">
              <p className="text-sm text-foreground-secondary">{t("items", { count: cart.count })}</p>
              <p className="mt-2 flex items-center justify-between">
                <span className="font-semibold text-foreground">{t("subtotal")}</span>
                <span className="font-script text-2xl text-brand-blue dark:text-brand-blue-light">{formatPrice(cart.subtotal, locale)}</span>
              </p>
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-sky/50 p-3 text-xs text-foreground-secondary dark:bg-surface-elevated">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-blue" /> {t("subtitle")}
              </p>
              <Link href="/checkout" className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-orange text-sm font-semibold text-white hover:bg-brand-orange-light">
                {t("checkoutAll", { count: cart.count })} <ArrowRight className="size-4" />
              </Link>
              <Link href="/products" className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-surface-hover">
                {t("continueShopping")}
              </Link>
              <button type="button" onClick={cart.clear} className="mt-2 w-full text-center text-xs text-foreground-muted hover:text-danger">
                {t("clear")}
              </button>
            </aside>
          </div>
        )}
      </Container>
    </>
  );
}
