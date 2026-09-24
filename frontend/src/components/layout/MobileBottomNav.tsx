"use client";

import { Heart, Home, LayoutGrid, Percent, UserRound, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWishlist } from "@/features/wishlist/WishlistProvider";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS: { key: "home" | "categories" | "deals" | "wishlist" | "account"; href: string; icon: LucideIcon }[] = [
  { key: "home", href: "/", icon: Home },
  { key: "categories", href: "/categories", icon: LayoutGrid },
  { key: "deals", href: "/deals", icon: Percent },
  { key: "wishlist", href: "/wishlist", icon: Heart },
  { key: "account", href: "/account", icon: UserRound },
];

/** Fixed five-tab bar below 1024px (design guide §21). Pages keep a 60px spacer above the footer for it. */
export function MobileBottomNav() {
  const t = useTranslations("market.bottomNav");
  const pathname = usePathname();
  const wishlist = useWishlist();
  const { status } = useAuth();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-market-border bg-market-surface pb-[env(safe-area-inset-bottom)] font-market shadow-[0_-4px_16px_rgba(15,42,76,0.08)] lg:hidden"
    >
      <ul className="grid h-[60px] grid-cols-5">
        {ITEMS.map(({ key, href, icon: Icon }) => {
          const active = isActive(href) || (key === "account" && pathname.startsWith("/login"));
          const to = key === "account" && status === "anonymous" ? "/login" : href;
          return (
            <li key={key}>
              <Link
                href={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors",
                  active ? "text-market-orange" : "text-market-text-secondary hover:text-market-navy"
                )}
              >
                <span className="relative">
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} aria-hidden />
                  {key === "wishlist" && wishlist.count > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-market-orange px-1 text-center text-[9px] font-bold leading-4 text-white">
                      {wishlist.count > 99 ? "99+" : wishlist.count}
                    </span>
                  )}
                </span>
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
