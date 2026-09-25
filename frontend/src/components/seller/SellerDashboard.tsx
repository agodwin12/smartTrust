"use client";

import { ArrowRight, CheckCircle2, CreditCard, Package, PlusCircle, Settings, ShoppingBag, Sparkles, TrendingUp, Wallet } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { formatDate, formatPrice } from "@/lib/format";
import type { Order, Paginated, SellerDashboard as Dashboard } from "@/types";
import { RatingStars } from "@/components/marketplace/RatingStars";

export function SellerDashboard() {
  const t = useTranslations("sellerArea.dashboard");
  const to = useTranslations("orders");
  const locale = useLocale();
  const { user, authFetch } = useAuth();
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch<{ store: Dashboard }>("stores/me").then(({ store }) => !cancelled && setDash(store)).catch(() => {});
    authFetch<Paginated<Order>>("orders/store", { params: { pageSize: 5 } })
      .then((r) => !cancelled && setOrders(r.items))
      .catch(() => !cancelled && setOrders([]));
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  if (!user) return null;
  const sub = dash?.subscription ?? null;

  const stats = [
    { key: "toDeliver", icon: ShoppingBag, value: dash?.stats.ordersToDeliver, href: "/seller/orders" },
    { key: "published", icon: Package, value: dash?.stats.listings.PUBLISHED, href: "/seller/listings" },
    { key: "completed", icon: CheckCircle2, value: dash?.stats.completedOrders, href: "/seller/orders" },
    { key: "totalSales", icon: TrendingUp, value: dash ? formatPrice(dash.stats.totalSales, locale) : undefined, href: "/seller/orders" },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">{t("greeting", { name: user.firstName })}</h1>
          <p className="mt-1 text-sm text-foreground-secondary">{t("subtitle", { store: user.store?.name ?? "" })}</p>
        </div>
        {typeof dash?.rating === "number" && (
          <div className="text-right text-xs text-foreground-muted">
            {t("rating")}
            <RatingStars rating={dash.rating} count={dash.reviewCount} size="md" />
          </div>
        )}
      </div>

      <section className="flex flex-col gap-4 rounded-3xl bg-[linear-gradient(135deg,var(--brand-blue),color-mix(in_oklab,var(--brand-blue)_70%,#0b1220))] p-6 text-white sm:flex-row sm:items-center">
        <Wallet className="size-8 shrink-0 text-brand-orange-light" />
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-white/70">{t("balance")}</p>
          <p className="font-bold text-4xl">{dash ? formatPrice(dash.wallet?.balance ?? 0, locale) : "…"}</p>
        </div>
        <Link href="/seller/wallet" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-orange px-5 text-sm font-semibold text-white hover:bg-brand-orange-light">
          {t("withdraw")} <ArrowRight className="size-4" />
        </Link>
      </section>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ key, icon: Icon, value, href }) => (
          <li key={key}>
            <Link href={href} className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-brand-blue/50">
              <Icon className="size-5 text-brand-blue dark:text-brand-blue-light" />
              <p className="mt-3 truncate font-display text-2xl text-foreground">{value ?? <span className="inline-block h-7 w-12 animate-pulse rounded bg-surface-hover" />}</p>
              <p className="text-xs text-foreground-muted">{t(key)}</p>
            </Link>
          </li>
        ))}
      </ul>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl">
              <CreditCard className="size-5 text-brand-orange" /> {t("plan.title")}
            </h2>
            {dash && !sub && <p className="mt-2 text-sm text-warning">{t("plan.none")}</p>}
            {sub && (
              <div className="mt-2 space-y-1 text-sm text-foreground-secondary">
                <p className="text-base font-semibold text-foreground">{sub.plan.name}</p>
                {sub.expiresAt && <p>{t("plan.expires", { date: formatDate(sub.expiresAt, locale) })}</p>}
                <p>{t("plan.quota", { used: sub.adsUsed, quota: sub.plan.adQuota })}</p>
                <p className="inline-flex items-center gap-1">
                  <Sparkles className="size-3.5 text-brand-orange" />
                  {sub.plan.heroEligible && sub.plan.heroDurationHours ? t("plan.hero", { hours: sub.plan.heroDurationHours }) : t("plan.noHero")}
                </p>
              </div>
            )}
          </div>
          <Link href="/seller/subscription" className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:border-brand-blue hover:text-brand-blue">
            {sub ? t("plan.renew") : t("plan.choose")}
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl">{t("recentOrders")}</h2>
          <Link href="/seller/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline">
            {t("allOrders")} <ArrowRight className="size-4" />
          </Link>
        </div>
        {orders === null ? (
          <div className="h-24 animate-pulse rounded-2xl bg-surface-hover" />
        ) : orders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-foreground-secondary">{t("noOrders")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {orders.map((order) => (
              <li key={order.id}>
                <Link href={`/seller/orders/${order.id}`} className="flex items-center gap-3 p-3 hover:bg-surface-hover sm:p-4">
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-hover">
                    {order.advertisement?.images?.[0] && <Image src={order.advertisement.images[0]} alt="" fill sizes="48px" className="object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{order.advertisement?.title}</span>
                    <span className="block text-xs text-foreground-muted">
                      {order.buyer ? `${order.buyer.firstName} ${order.buyer.lastName}` : ""} · {formatDate(order.createdAt, locale)} · {to(`status.${order.status}`)}
                    </span>
                  </span>
                  <span className="font-bold text-lg text-brand-blue dark:text-brand-blue-light">{formatPrice(order.totalAmount, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { key: "newListing", href: "/seller/listings/new", icon: PlusCircle },
          { key: "listings", href: "/seller/listings", icon: Package },
          { key: "wallet", href: "/seller/wallet", icon: Wallet },
          { key: "store", href: "/seller/store", icon: Settings },
        ].map(({ key, href, icon: Icon }) => (
          <li key={key}>
            <Link href={href} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-sm font-semibold text-foreground transition-colors hover:border-brand-orange">
              <Icon className="size-5 text-brand-orange" /> {t(`quick.${key}`)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
