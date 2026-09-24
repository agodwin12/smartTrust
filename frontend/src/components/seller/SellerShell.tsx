"use client";

import { ExternalLink, LayoutDashboard, Package, ShoppingBag, Store, Wallet, CreditCard, Settings, Zap, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Container } from "@/components/layout/Container";

const ITEMS: { key: "dashboard" | "listings" | "flashDeals" | "orders" | "subscription" | "wallet" | "store"; href: string; icon: LucideIcon; exact?: boolean }[] = [
  { key: "dashboard", href: "/seller", icon: LayoutDashboard, exact: true },
  { key: "listings", href: "/seller/listings", icon: Package },
  { key: "flashDeals", href: "/seller/flash-deals", icon: Zap },
  { key: "orders", href: "/seller/orders", icon: ShoppingBag },
  { key: "subscription", href: "/seller/subscription", icon: CreditCard },
  { key: "wallet", href: "/seller/wallet", icon: Wallet },
  { key: "store", href: "/seller/store", icon: Settings },
];

function SellerNav() {
  const t = useTranslations("sellerArea.nav");
  const pathname = usePathname();
  const { user } = useAuth();
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav aria-label={t("dashboard")} className="min-w-0 lg:sticky lg:top-28">
      <ul className="scrollbar-thin -mx-4 flex max-w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:max-w-none lg:flex-col lg:overflow-visible lg:px-0">
        {ITEMS.map(({ key, href, icon: Icon, exact }) => (
          <li key={key} className="shrink-0">
            <Link
              href={href}
              aria-current={isActive(href, exact) ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors lg:w-full",
                isActive(href, exact) ? "bg-brand-orange text-white" : "text-foreground-secondary hover:bg-surface-hover hover:text-foreground"
              )}
            >
              <Icon className="size-4" /> {t(key)}
            </Link>
          </li>
        ))}
      </ul>
      {user?.store && (
        <Link href={`/stores/${user.store.slug}`} className="mt-4 hidden items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-sm font-semibold text-foreground transition-colors hover:border-brand-blue hover:text-brand-blue lg:flex">
          <ExternalLink className="size-4" /> {t("viewStore")}
        </Link>
      )}
    </nav>
  );
}

function StoreGate({ children }: { children: ReactNode }) {
  const t = useTranslations("sellerArea");
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const onboarding = pathname === "/seller/onboarding";
  const hasStore = !!user?.store;

  useEffect(() => {
    if (hasStore && onboarding) router.replace("/seller");
  }, [hasStore, onboarding, router]);

  if (onboarding) return hasStore ? null : <>{children}</>;

  if (!hasStore) {
    return (
      <Container className="flex flex-1 items-center justify-center py-16">
        <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 text-center">
          <span className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
            <Store className="size-6" />
          </span>
          <h1 className="mt-4 text-2xl">{t("gate.title")}</h1>
          <p className="mt-2 text-sm text-foreground-secondary">{t("gate.description")}</p>
          <Link href="/seller/onboarding" className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-orange text-sm font-semibold text-white hover:bg-brand-orange-light">
            {t("gate.action")}
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8 sm:py-12">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-brand-orange lg:hidden">{t("title")}</p>
      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <SellerNav />
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}

/** Every /seller page: sign-in gate → store gate (onboarding) → seller navigation + content. */
export function SellerShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <StoreGate>{children}</StoreGate>
    </RequireAuth>
  );
}
