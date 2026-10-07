"use client";

import { MessageCircle } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { useChat } from "@/features/chat/ChatProvider";
import { Link } from "@/i18n/navigation";
import { formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Conversation, Paginated } from "@/types";
import { counterpartOf } from "@/components/chat/ChatThread";

type Tab = "all" | "buying" | "selling";

/** The conversation snippet shown in a list: text, or "Photo" / "Product" for those messages. */
export function usePreview() {
  const t = useTranslations("messaging");
  return (preview: string | null) => (preview === "[image]" ? t("photo") : preview === "[product]" ? t("product") : preview ?? "");
}

/** Inbox: newest activity first, unread counts, live refresh; Buying / Selling tabs for store owners. */
export function ConversationList({ activeId }: { activeId?: string }) {
  const t = useTranslations("messaging");
  const locale = useLocale();
  const { user, authFetch } = useAuth();
  const { on } = useChat();
  const preview = usePreview();
  const initialTab = useSearchParams().get("tab");
  const [tab, setTab] = useState<Tab>(initialTab === "selling" || initialTab === "buying" ? initialTab : "all");
  const [items, setItems] = useState<Conversation[] | null>(null);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStore = !!user?.store;

  const load = useCallback(() => {
    authFetch<Paginated<Conversation>>("conversations", { params: { role: tab === "all" ? undefined : tab, pageSize: 50 } })
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, [authFetch, tab]);

  useEffect(() => {
    load();
  }, [load]);

  // Any new message or read receipt: refresh the list (once for a burst).
  useEffect(() => {
    const later = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(load, 300);
    };
    const offNew = on("message:new", later);
    const offRead = on("conversation:read", later);
    return () => {
      offNew();
      offRead();
    };
  }, [on, load]);

  const today = new Date().toDateString();
  const when = (iso: string) => {
    const d = new Date(iso);
    return d.toDateString() === today ? d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : formatDate(d, locale, { day: "numeric", month: "short" });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface lg:h-[calc(100dvh-11rem)]">
      <div className="border-b border-border px-4 pb-3 pt-4">
        <h1 className="text-2xl">{t("title")}</h1>
        {hasStore && (
          <div role="tablist" className="mt-3 flex gap-1.5">
            {(["all", "buying", "selling"] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn("h-8 rounded-full px-3 text-xs font-semibold transition-colors", tab === key ? "bg-brand-blue text-white" : "bg-surface-hover text-foreground-secondary hover:text-foreground")}
              >
                {t(`tabs.${key}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {items === null ? (
        <div className="space-y-2 p-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-hover" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
            <MessageCircle className="size-6" aria-hidden />
          </span>
          <p className="font-semibold text-foreground">{t("empty.title")}</p>
          <p className="text-sm text-foreground-secondary">{t("empty.description")}</p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto p-2">
          {items.map((c) => {
            const other = counterpartOf(c);
            const active = c.id === activeId;
            return (
              <li key={c.id}>
                <Link
                  href={`/messages/${c.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex items-center gap-3 rounded-2xl px-2.5 py-2.5 transition-colors", active ? "bg-brand-blue/10" : "hover:bg-surface-hover")}
                >
                  <span className="relative inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-blue/10 text-xs font-bold text-brand-blue dark:text-brand-blue-light">
                    {other.logo ? <Image src={other.logo} alt="" fill sizes="44px" className="object-cover" /> : initials(other.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-sm text-foreground", c.unread > 0 ? "font-bold" : "font-semibold")}>{other.name}</span>
                      <span className="shrink-0 text-[11px] text-foreground-muted">{when(c.lastMessageAt)}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-xs", c.unread > 0 ? "font-semibold text-foreground" : "text-foreground-muted")}>
                        {c.side === "seller" && <span className="mr-1 rounded bg-brand-orange/15 px-1 py-px text-[10px] font-bold uppercase text-brand-orange">{t("customerTag")}</span>}
                        {preview(c.lastMessagePreview)}
                      </span>
                      {c.unread > 0 && <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-orange px-1.5 text-[11px] font-bold leading-5 text-white">{c.unread > 99 ? "99+" : c.unread}</span>}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
