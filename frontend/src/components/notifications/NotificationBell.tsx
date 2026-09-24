"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/features/notifications/notifications";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const POLL_MS = 60_000;

/** Header bell with the unread count — polls once a minute while signed in, and refreshes when the tab regains focus. */
export function NotificationBell({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const { status, authFetch } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    const load = () =>
      authFetch<{ unread: number }>("notifications/unread-count")
        .then((data) => {
          if (!cancelled) setUnread(data.unread);
        })
        .catch(() => {});
    void load();
    const timer = window.setInterval(load, POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onFocus);
    };
  }, [status, authFetch]);

  if (status !== "authenticated") return null;

  return (
    <Link
      href="/account/notifications"
      aria-label={t("notifications")}
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-full text-foreground-secondary transition-colors hover:bg-surface-hover hover:text-foreground",
        className
      )}
    >
      <Bell className="size-5" />
      {unread > 0 && (
        <span className="absolute right-0.5 top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-bold leading-4 text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
