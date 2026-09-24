"use client";

import { Heart, LogOut, Menu, Package, ShoppingCart, Store, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/features/auth/AuthProvider";
import { useCart } from "@/features/cart/CartProvider";
import { useWishlist } from "@/features/wishlist/WishlistProvider";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { MarketSearch } from "@/components/layout/MarketSearch";
import { UserMenu } from "@/components/layout/UserMenu";
import { BrandMark } from "@/components/market/BrandMark";
import { MarketContainer } from "@/components/market/MarketContainer";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Category } from "@/types";

const QUICK_LINKS = [
  { key: "categories", href: "/categories" },
  { key: "deals", href: "/deals" },
  { key: "stores", href: "/stores" },
  { key: "subscriptions", href: "/subscriptions" },
  { key: "howItWorks", href: "/how-it-works" },
] as const;

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-0.5 top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-market-orange px-1 text-[10px] font-bold leading-4 text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

type HeaderProps = {
  /** Root categories for the search select (fetched by PageShell). */
  categories?: Category[];
  /** Slim quick-links row under the navy bar; the home page hides it because its sidebar covers navigation. */
  quickLinks?: boolean;
};

/**
 * Marketplace header (design guide §8 / §17): a 58px navy bar with a dominant search field on
 * desktop, and a white two-row header (actions, then full-width search) below 1024px.
 */
export function Header({ categories = [], quickLinks = true }: HeaderProps) {
  const t = useTranslations("nav");
  const { status, user, logout } = useAuth();
  const cart = useCart();
  const wishlist = useWishlist();

  const sellerHref = user?.store ? "/seller" : "/sell";
  const sellerLabel = user?.store ? t("myStore") : t("becomeSeller");

  const navyAction = "relative inline-flex h-10 items-center gap-1.5 rounded-[7px] px-2 text-[12px] font-semibold text-white/90 transition-colors hover:bg-white/10 hover:text-white";
  const lightAction = "relative inline-flex size-10 items-center justify-center rounded-full text-market-navy transition-colors hover:bg-market-blue-light";
  const mobileLinkClass = "rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-surface-hover";

  return (
    <header className="sticky top-0 z-40 font-market">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-md focus:bg-market-orange focus:px-3 focus:py-1.5 focus:text-sm focus:text-white"
      >
        {t("skipToContent")}
      </a>

      {/* Desktop: navy bar */}
      <div className="hidden bg-market-navy text-white lg:block">
        <MarketContainer className="flex h-[58px] items-center gap-3">
          <BrandMark tone="dark" className="mr-1" />
          <MarketSearch categories={categories} withCategory className="min-w-0 max-w-3xl flex-1" />

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <LanguageSwitcher tone="dark" />
            <ThemeToggle tone="dark" className="ml-1" />
            <NotificationBell className="text-white/90 hover:bg-white/10 hover:text-white" />
            <Link href="/wishlist" aria-label={t("wishlist")} className={navyAction}>
              <Heart className={cn("size-5", wishlist.count > 0 && "fill-market-orange text-market-orange")} aria-hidden />
              <span className="hidden xl:inline">{t("wishlist")}</span>
              <CountBadge count={wishlist.count} />
            </Link>
            <Link href="/cart" aria-label={t("cart")} className={navyAction}>
              <ShoppingCart className="size-5" aria-hidden />
              <span className="hidden xl:inline">{t("cart")}</span>
              <CountBadge count={cart.count} />
            </Link>
            <UserMenu tone="dark" />
            <Link
              href={sellerHref}
              className="ml-1 inline-flex h-9 items-center whitespace-nowrap rounded-[7px] bg-market-orange px-3.5 text-[12px] font-bold text-white shadow-sm transition-colors hover:bg-market-orange-dark"
            >
              {sellerLabel}
            </Link>
          </div>
        </MarketContainer>

        {quickLinks && (
          <div className="border-t border-white/10 bg-market-navy-dark">
            <MarketContainer className="flex h-9 items-center gap-1">
              {QUICK_LINKS.map((link) => (
                <Link key={link.key} href={link.href} className="inline-flex h-full items-center rounded-[6px] px-2.5 text-[12px] font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white">
                  {t(link.key)}
                </Link>
              ))}
            </MarketContainer>
          </div>
        )}
      </div>

      {/* Phones and tablets: white two-row header */}
      <div className="border-b border-market-border bg-market-surface lg:hidden">
        <MarketContainer className="flex h-[52px] items-center gap-1">
          <Sheet>
            <SheetTrigger aria-label={t("menu")} className={cn(lightAction, "-ml-2")}>
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[86%] max-w-sm gap-0 bg-surface p-0">
              <SheetHeader className="border-b border-border px-5 py-4">
                <SheetTitle>
                  <BrandMark tone="light" size="sm" />
                </SheetTitle>
              </SheetHeader>

              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">{t("language")}</span>
                <div className="flex items-center gap-2">
                  <LanguageSwitcher />
                  <ThemeToggle />
                </div>
              </div>

              {status === "authenticated" && user && (
                <div className="border-b border-border px-5 py-4">
                  <p className="text-[11px] uppercase tracking-wider text-foreground-muted">{t("signedInAs")}</p>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="truncate text-xs text-foreground-muted">{user.email}</p>
                </div>
              )}

              <nav className="flex flex-col px-3 py-3">
                {QUICK_LINKS.map((link) => (
                  <SheetClose key={link.key} nativeButton={false} render={<Link href={link.href} className={mobileLinkClass} />}>
                    {t(link.key)}
                  </SheetClose>
                ))}
                {status === "authenticated" && (
                  <>
                    <SheetClose nativeButton={false} render={<Link href="/account" className={cn(mobileLinkClass, "flex items-center gap-2")} />}>
                      <UserRound className="size-4" /> {t("account")}
                    </SheetClose>
                    <SheetClose nativeButton={false} render={<Link href="/account/orders" className={cn(mobileLinkClass, "flex items-center gap-2")} />}>
                      <Package className="size-4" /> {t("myOrders")}
                    </SheetClose>
                    <SheetClose nativeButton={false} render={<Link href={sellerHref} className={cn(mobileLinkClass, "flex items-center gap-2")} />}>
                      <Store className="size-4" /> {user?.store ? t("myStore") : t("sell")}
                    </SheetClose>
                  </>
                )}
              </nav>

              <div className="mt-auto flex flex-col gap-3 border-t border-border px-5 py-5">
                {status === "authenticated" ? (
                  <SheetClose
                    onClick={() => void logout()}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover"
                  >
                    <LogOut className="size-4" /> {t("signOut")}
                  </SheetClose>
                ) : (
                  <>
                    <SheetClose
                      nativeButton={false}
                      render={<Link href="/sell" className="inline-flex h-11 items-center justify-center rounded-xl bg-market-orange text-sm font-semibold text-white transition-colors hover:bg-market-orange-dark" />}
                    >
                      {t("becomeSeller")}
                    </SheetClose>
                    <SheetClose
                      nativeButton={false}
                      render={<Link href="/login" className="inline-flex h-11 items-center justify-center rounded-xl border border-border text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover" />}
                    >
                      {t("signIn")}
                    </SheetClose>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <BrandMark tone="light" size="sm" />

          <div className="ml-auto flex items-center">
            <LanguageSwitcher compact className="mr-1 size-9 text-[11px]" />
            <NotificationBell className={lightAction} />
            <Link href="/wishlist" aria-label={t("wishlist")} className={lightAction}>
              <Heart className={cn("size-5", wishlist.count > 0 && "fill-market-orange text-market-orange")} aria-hidden />
              <CountBadge count={wishlist.count} />
            </Link>
            <Link href="/cart" aria-label={t("cart")} className={cn(lightAction, "-mr-2")}>
              <ShoppingCart className="size-5" aria-hidden />
              <CountBadge count={cart.count} />
            </Link>
          </div>
        </MarketContainer>
        <MarketContainer className="pb-2.5">
          <MarketSearch categories={categories} className="h-9 bg-market-canvas" />
        </MarketContainer>
      </div>
    </header>
  );
}
