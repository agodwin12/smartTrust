"use client";

import { Bell, BellRing, CheckCheck, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { announceNotificationsChanged, notificationHref, notificationValues } from "@/features/notifications/notifications";
import { Link, useRouter } from "@/i18n/navigation";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppNotification, Paginated } from "@/types";
import { EmptyState } from "@/components/ui/EmptyState";

type Page = Paginated<AppNotification> & { unread: number };

export function NotificationsView() {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const { authFetch } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState<Page | null>(null);

  const load = useCallback(
    () =>
      authFetch<Page>("notifications", { params: { pageSize: 50 } })
        .then(setPage)
        .catch(() => setPage({ items: [], total: 0, page: 1, pageSize: 50, unread: 0 })),
    [authFetch]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const render = (n: AppNotification) => {
    const values = notificationValues(n, (v) => formatPrice(v, locale));
    const key = `types.${n.type}`;
    return {
      title: t.has(`${key}.title`) ? t(`${key}.title`, values) : n.title,
      body: t.has(`${key}.body`) ? t(`${key}.body`, values) : n.body,
    };
  };

  const open = async (n: AppNotification) => {
    if (!n.isRead) {
      setPage((prev) => prev && { ...prev, unread: Math.max(0, prev.unread - 1), items: prev.items.map((i) => (i.id === n.id ? { ...i, isRead: true } : i)) });
      authFetch(`notifications/${n.id}/read`, { method: "PATCH" }).then(announceNotificationsChanged).catch(() => {});
    }
    router.push(notificationHref(n));
  };

  const markAll = async () => {
    await authFetch("notifications/read-all", { method: "POST" }).catch(() => {});
    announceNotificationsChanged();
    setPage((prev) => prev && { ...prev, unread: 0, items: prev.items.map((i) => ({ ...i, isRead: true })) });
    toast.success(t("allRead"));
  };

  if (!page) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-hover" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-foreground-secondary">{t("unread", { count: page.unread })}</p>
        {page.unread > 0 && (
          <button type="button" onClick={markAll} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:border-brand-blue hover:text-brand-blue">
            <CheckCheck className="size-4" /> {t("markAllRead")}
          </button>
        )}
      </div>
      {page.items.length === 0 ? (
        <EmptyState icon={Bell} title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <ul className="space-y-2">
          {page.items.map((n) => {
            const { title, body } = render(n);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors hover:border-brand-blue/50",
                    n.isRead ? "border-border bg-surface" : "border-brand-blue/30 bg-brand-sky/30 dark:bg-surface-elevated"
                  )}
                >
                  <span className={cn("mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full", n.isRead ? "bg-surface-hover text-foreground-muted" : "bg-brand-blue text-white")}>
                    {n.isRead ? <Bell className="size-4" /> : <BellRing className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", n.isRead ? "font-medium text-foreground" : "font-semibold text-foreground")}>{title}</span>
                    {body && <span className="mt-0.5 block text-sm text-foreground-secondary">{body}</span>}
                    <span className="mt-1 block text-xs text-foreground-muted">{formatDate(n.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</span>
                  </span>
                  <ChevronRight className="mt-2 size-4 shrink-0 text-foreground-muted" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 text-center text-xs text-foreground-muted">
        <Link href="/account" className="hover:text-foreground">{t("title")} · {page.total}</Link>
      </p>
    </div>
  );
}
