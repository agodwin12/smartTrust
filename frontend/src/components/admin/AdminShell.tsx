"use client";

import {
  ArrowDownToLine,
  Banknote,
  CreditCard,
  FolderTree,
  Inbox,
  LayoutDashboard,
  Package,
  Scale,
  ScrollText,
  ShieldAlert,
  ShoppingBag,
  Store,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { canFinance, isStaff } from "@/features/admin/roles";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { User } from "@/types";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Container } from "@/components/layout/Container";

type NavKey = "dashboard" | "users" | "stores" | "categories" | "listings" | "flashDeals" | "plans" | "orders" | "payments" | "disputes" | "withdrawals" | "support" | "audit";

const ITEMS: { key: NavKey; href: string; icon: LucideIcon; exact?: boolean; visible?: (user: User) => boolean }[] = [
  { key: "dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
  { key: "orders", href: "/admin/orders", icon: ShoppingBag },
  { key: "disputes", href: "/admin/disputes", icon: Scale },
  { key: "payments", href: "/admin/payments", icon: Banknote, visible: canFinance },
  { key: "withdrawals", href: "/admin/withdrawals", icon: ArrowDownToLine, visible: canFinance },
  { key: "users", href: "/admin/users", icon: Users },
  { key: "stores", href: "/admin/stores", icon: Store },
  { key: "listings", href: "/admin/listings", icon: Package },
  { key: "flashDeals", href: "/admin/flash-deals", icon: Zap },
  { key: "categories", href: "/admin/categories", icon: FolderTree },
  { key: "plans", href: "/admin/plans", icon: CreditCard },
  { key: "support", href: "/admin/support", icon: Inbox },
  { key: "audit", href: "/admin/audit", icon: ScrollText },
];

function AdminNav({ user }: { user: User }) {
  const t = useTranslations("admin.nav");
  const tr = useTranslations("admin.users.roles");
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const items = ITEMS.filter((item) => !item.visible || item.visible(user));

  return (
    <nav aria-label={t("dashboard")} className="min-w-0 lg:sticky lg:top-28">
      <div className="mb-3 hidden items-center gap-3 rounded-2xl border border-border bg-surface p-3 lg:flex">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue dark:text-brand-blue-light">
          <ShieldAlert className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-xs text-foreground-muted">{tr(user.role)}</p>
        </div>
      </div>
      <ul className="scrollbar-thin -mx-4 flex max-w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:max-w-none lg:flex-col lg:overflow-visible lg:px-0">
        {items.map(({ key, href, icon: Icon, exact }) => (
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
    </nav>
  );
}

function StaffGate({ children }: { children: ReactNode }) {
  const t = useTranslations("admin");
  const tr = useTranslations("admin.users.roles");
  const { user } = useAuth();

  if (!user) return null;

  if (!isStaff(user)) {
    return (
      <Container className="flex flex-1 items-center justify-center py-16">
        <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 text-center">
          <span className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
            <ShieldAlert className="size-6" />
          </span>
          <h1 className="mt-4 text-2xl">{t("noAccess.title")}</h1>
          <p className="mt-2 text-sm text-foreground-secondary">{t("noAccess.description")}</p>
          <Link href="/" className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-blue text-sm font-semibold text-white hover:bg-brand-blue-light">
            {t("noAccess.action")}
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8 sm:py-12">
      <p className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue lg:hidden">
        {t("title")}
        <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[10px] tracking-normal">{tr(user.role)}</span>
      </p>
      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <AdminNav user={user} />
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}

/** Every /admin page: sign-in gate → staff-role gate → admin navigation + content. */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <StaffGate>{children}</StaffGate>
    </RequireAuth>
  );
}
