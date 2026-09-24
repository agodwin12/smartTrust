"use client";

import { ArrowRight, Bell, CheckCircle2, Heart, MailWarning, Package, ShieldCheck, Store } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWishlist } from "@/features/wishlist/WishlistProvider";
import { Link } from "@/i18n/navigation";
import { formatDate, formatPrice } from "@/lib/format";
import type { Order, Paginated } from "@/types";

type Stats = { orders: number; escrow: number; completed: number; unread: number; recent: Order[] };

export function AccountOverview() {
  const t = useTranslations("account.overview");
  const to = useTranslations("orders");
  const locale = useLocale();
  const { user, authFetch } = useAuth();
  const wishlist = useWishlist();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      authFetch<Paginated<Order>>("orders/me", { params: { pageSize: 100 } }).catch(() => ({ items: [] as Order[] })),
      authFetch<{ unread: number }>("notifications/unread-count").catch(() => ({ unread: 0 })),
    ]).then(([orders, notifications]) => {
      if (cancelled) return;
      const items = orders.items;
      setStats({
        orders: items.length,
        escrow: items.filter((o) => o.status === "PAID" || o.status === "DISPUTED").length,
        completed: items.filter((o) => o.status === "COMPLETED").length,
        unread: notifications.unread,
        recent: items.slice(0, 3),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  if (!user) return null;

  const cards = [
    { key: "orders", icon: Package, value: stats?.orders, href: "/account/orders" },
    { key: "escrow", icon: ShieldCheck, value: stats?.escrow, href: "/account/orders" },
    { key: "completed", icon: CheckCircle2, value: stats?.completed, href: "/account/orders" },
    { key: "unread", icon: Bell, value: stats?.unread, href: "/account/notifications" },
    { key: "wishlist", icon: Heart, value: wishlist.count, href: "/wishlist" },
  ] as const;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl">{t("greeting", { name: user.firstName })}</h1>
        <p className="mt-1 text-sm text-foreground-secondary">{t("subtitle")}</p>
      </div>

      {!user.emailVerifiedAt && (
        <div className="flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center">
          <MailWarning className="size-6 shrink-0 text-warning" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{t("verify.title")}</p>
            <p className="text-xs text-foreground-secondary">{t("verify.description")}</p>
          </div>
          <Link href="/verify-email?next=%2Faccount" className="inline-flex h-10 items-center rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white hover:bg-brand-blue-light">
            {t("verify.action")}
          </Link>
        </div>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(({ key, icon: Icon, value, href }) => (
          <li key={key}>
            <Link href={href} className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-brand-blue/50">
              <Icon className="size-5 text-brand-blue dark:text-brand-blue-light" />
              <p className="mt-3 font-display text-3xl text-foreground">{value ?? <span className="inline-block h-8 w-10 animate-pulse rounded bg-surface-hover" />}</p>
              <p className="text-xs text-foreground-muted">{t(`stats.${key}`)}</p>
            </Link>
          </li>
        ))}
      </ul>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl">{t("recentOrders")}</h2>
          <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline">
            {t("viewAll")} <ArrowRight className="size-4" />
          </Link>
        </div>
        {stats === null ? (
          <div className="h-24 animate-pulse rounded-2xl bg-surface-hover" />
        ) : stats.recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-foreground-secondary">{t("noOrders")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {stats.recent.map((order) => (
              <li key={order.id}>
                <Link href={`/account/orders/${order.id}`} className="flex items-center gap-3 p-3 hover:bg-surface-hover sm:p-4">
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-hover">
                    {order.advertisement?.images?.[0] && <Image src={order.advertisement.images[0]} alt="" fill sizes="48px" className="object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{order.advertisement?.title}</span>
                    <span className="block text-xs text-foreground-muted">
                      {formatDate(order.createdAt, locale)} · {to(`status.${order.status}`)}
                    </span>
                  </span>
                  <span className="font-script text-lg text-brand-blue dark:text-brand-blue-light">{formatPrice(order.totalAmount, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-3xl bg-[linear-gradient(135deg,var(--brand-blue),color-mix(in_oklab,var(--brand-blue)_70%,#0b1220))] p-6 text-white sm:flex-row sm:items-center">
        <Store className="size-8 shrink-0 text-brand-orange-light" />
        <div className="flex-1">
          <h2 className="text-xl text-white">{t("seller.title")}</h2>
          <p className="mt-1 text-sm text-white/80">{t("seller.description")}</p>
        </div>
        <Link href={user.store ? "/seller" : "/seller/onboarding"} className="inline-flex h-11 items-center rounded-xl bg-brand-orange px-5 text-sm font-semibold text-white hover:bg-brand-orange-light">
          {user.store ? t("seller.manage") : t("seller.action")}
        </Link>
      </section>
    </div>
  );
}
