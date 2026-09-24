"use client";

import { Bell, Heart, LayoutDashboard, Package, Store, UserRound, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS: { key: "overview" | "orders" | "wishlist" | "notifications" | "profile"; href: string; icon: LucideIcon; exact?: boolean }[] = [
  { key: "overview", href: "/account", icon: LayoutDashboard, exact: true },
  { key: "orders", href: "/account/orders", icon: Package },
  { key: "wishlist", href: "/wishlist", icon: Heart },
  { key: "notifications", href: "/account/notifications", icon: Bell },
  { key: "profile", href: "/account/profile", icon: UserRound },
];

/** Side navigation on desktop, horizontal scrolling tabs on phones. */
export function AccountNav() {
  const t = useTranslations("account.nav");
  const pathname = usePathname();
  const { user } = useAuth();

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav aria-label={t("overview")} className="min-w-0 lg:sticky lg:top-28">
      <ul className="scrollbar-thin -mx-4 flex max-w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:max-w-none lg:flex-col lg:overflow-visible lg:px-0">
        {ITEMS.map(({ key, href, icon: Icon, exact }) => (
          <li key={key} className="shrink-0">
            <Link
              href={href}
              aria-current={isActive(href, exact) ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors lg:w-full",
                isActive(href, exact) ? "bg-brand-blue text-white" : "text-foreground-secondary hover:bg-surface-hover hover:text-foreground"
              )}
            >
              <Icon className="size-4" /> {t(key)}
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href={user?.store ? "/seller" : "/seller/onboarding"}
        className="mt-4 hidden items-start gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-brand-orange lg:flex"
      >
        <Store className="mt-0.5 size-5 text-brand-orange" />
        <span>
          <span className="block text-sm font-semibold text-foreground">{t("seller")}</span>
          <span className="block text-xs text-foreground-muted">{user?.store ? user.store.name : t("sellerHint")}</span>
        </span>
      </Link>
    </nav>
  );
}
