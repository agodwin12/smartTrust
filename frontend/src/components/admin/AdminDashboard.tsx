"use client";

import { ArrowRight, Banknote, CreditCard, Inbox, Package, Scale, ShoppingBag, Store, TrendingUp, UserCog, Users, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { canFinance } from "@/features/admin/roles";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { formatDate, formatPrice } from "@/lib/format";
import type { AdminStats, AuditLog, OrderStatus, Paginated } from "@/types";
import { AdminJobsPanel } from "./AdminJobsPanel";
import { IdChip, StatCard, StatusPill } from "./primitives";

const ORDER_STATUSES: OrderStatus[] = ["PENDING_PAYMENT", "CONFIRMED", "PAID", "DISPUTED", "COMPLETED", "REFUNDED", "CANCELLED"];

export function AdminDashboard() {
  const t = useTranslations("admin.dashboard");
  const to = useTranslations("orders");
  const ta = useTranslations("admin.audit");
  const locale = useLocale();
  const { user, authFetch } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [logs, setLogs] = useState<AuditLog[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch<AdminStats>("admin/stats").then((s) => !cancelled && setStats(s)).catch(() => {});
    authFetch<Paginated<AuditLog>>("audit-logs", { params: { pageSize: 8 } })
      .then((r) => !cancelled && setLogs(r.items))
      .catch(() => !cancelled && setLogs([]));
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const finance = canFinance(user);
  const totalOrders = stats ? Object.values(stats.orders).reduce((a, b) => a + (b ?? 0), 0) : undefined;

  const cards = [
    { key: "orders", icon: <ShoppingBag className="size-5" />, value: totalOrders, href: "/admin/orders", tone: "info" as const },
    { key: "disputes", icon: <Scale className="size-5" />, value: stats?.disputesOpen, href: "/admin/disputes", tone: stats?.disputesOpen ? ("danger" as const) : ("success" as const) },
    { key: "escrow", icon: <Wallet className="size-5" />, value: stats ? formatPrice(stats.escrow.held, locale) : undefined, href: finance ? "/admin/payments" : "/admin/orders", tone: "warning" as const },
    { key: "sales", icon: <TrendingUp className="size-5" />, value: stats ? formatPrice(stats.sales.amount, locale) : undefined, href: "/admin/orders", tone: "success" as const },
    { key: "withdrawals", icon: <Banknote className="size-5" />, value: stats?.withdrawalsPending.count, href: finance ? "/admin/withdrawals" : undefined, tone: "warning" as const },
    { key: "stores", icon: <Store className="size-5" />, value: stats?.stores.ACTIVE ?? (stats ? 0 : undefined), href: "/admin/stores", tone: "info" as const },
    { key: "storesPending", icon: <Store className="size-5" />, value: stats?.stores.PENDING ?? (stats ? 0 : undefined), href: "/admin/stores?status=PENDING", tone: stats?.stores.PENDING ? ("warning" as const) : ("muted" as const) },
    { key: "listings", icon: <Package className="size-5" />, value: stats?.listings.PUBLISHED ?? (stats ? 0 : undefined), href: "/admin/listings", tone: "info" as const },
    { key: "users", icon: <Users className="size-5" />, value: stats?.users.total, href: "/admin/users", tone: "info" as const },
    { key: "staff", icon: <UserCog className="size-5" />, value: stats?.users.staff, href: "/admin/users?role=staff", tone: "muted" as const },
    { key: "subscriptions", icon: <CreditCard className="size-5" />, value: stats?.subscriptionsActive, href: "/admin/plans", tone: "success" as const },
    { key: "contacts", icon: <Inbox className="size-5" />, value: stats?.contactsUnhandled, href: "/admin/support", tone: stats?.contactsUnhandled ? ("warning" as const) : ("muted" as const) },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground-secondary">{t("subtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <StatCard key={c.key} icon={c.icon} label={t(c.key)} value={c.value} href={c.href} tone={c.tone} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-lg">{t("ordersByStatus")}</h2>
          <ul className="mt-4 space-y-2.5">
            {ORDER_STATUSES.map((status) => {
              const count = stats?.orders[status] ?? 0;
              const share = totalOrders ? Math.round((count / totalOrders) * 100) : 0;
              return (
                <li key={status}>
                  <Link href={`/admin/orders?status=${status}`} className="group block">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <StatusPill status={status} label={to(`status.${status}`)} />
                      <span className="font-semibold text-foreground">{stats ? count : "…"}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-hover">
                      <div className="h-full rounded-full bg-brand-blue transition-[width] duration-500 group-hover:bg-brand-orange" style={{ width: `${share}%` }} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg">{t("recentActivity")}</h2>
            <Link href="/admin/audit" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline">
              {t("allActivity")} <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {logs === null ? (
            <div className="mt-4 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-hover" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="mt-4 text-sm text-foreground-muted">{ta("system")}</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {logs.map((log) => (
                <li key={log.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{log.action.replace(/_/g, " ").toLowerCase()}</p>
                    <p className="truncate text-xs text-foreground-muted">
                      {log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : ta("system")}
                      {log.entityType && (
                        <>
                          {" · "}
                          {log.entityType} {log.entityId && <IdChip id={log.entityId} />}
                        </>
                      )}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-foreground-muted">{formatDate(log.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AdminJobsPanel />
    </div>
  );
}
