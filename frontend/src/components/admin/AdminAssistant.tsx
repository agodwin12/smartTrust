"use client";

import { ExternalLink, Loader2, Lock, RotateCcw, Send, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { isSuperAdmin } from "@/features/admin/roles";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { ApiRequestError } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";
import { AdminHeader, StatusPill } from "./primitives";

type OrderCard = { id: string; shortId: string; reference: string | null; title: string; status: OrderStatus; totalAmount: string; createdAt: string };
type Reply = { reply: string; orders: OrderCard[]; model: string };
type Message = { id: number; from: "user" | "assistant"; text: string; orders?: OrderCard[]; fallback?: boolean; error?: boolean };
type Status = { configured: boolean; available: boolean; model: string };

const SUGGESTIONS = ["today", "week", "awaiting", "disputes", "stores", "top", "failed", "activity"] as const;
const HISTORY_LIMIT = 12;

/** Turns "/admin/orders/x" style paths into links and strips stray markdown emphasis. */
function renderText(text: string): ReactNode[] {
  const clean = text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^\s*[*-]\s+/gm, "• ");
  return clean.split(/((?<![\w/])\/admin\/[\w\-/?=&]+)/g).map((part, i) =>
    i % 2 === 1 ? (
      <Link key={i} href={part} className="font-semibold text-brand-blue underline underline-offset-2 dark:text-brand-blue-light">
        {part}
      </Link>
    ) : (
      part
    )
  );
}

/**
 * Super Admin AI assistant (Gemini): questions about orders, money and activity with any filter
 * the admin types ("orders from Smart Trust waiting for delivery", "what happened last week").
 */
export function AdminAssistant() {
  const t = useTranslations("admin.assistant");
  const to = useTranslations("orders");
  const locale = useLocale();
  const { user, authFetch } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const allowed = isSuperAdmin(user);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    authFetch<Status>("admin/assistant/status")
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setStatus({ configured: false, available: false, model: "" }));
    return () => {
      cancelled = true;
    };
  }, [allowed, authFetch]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text: string) => {
    nextId.current += 2;
    const id = nextId.current;
    const next: Message[] = [...messages, { id, from: "user", text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const history = next
        .filter((m) => !m.error && !m.fallback)
        .slice(-HISTORY_LIMIT)
        .map((m) => ({ role: m.from, content: m.text }));
      while (history.length && history[0].role !== "user") history.shift();
      const data = await authFetch<Reply>("admin/assistant/chat", { method: "POST", body: { messages: history, locale } });
      setMessages((m) => [...m, { id: id + 1, from: "assistant", text: data.reply, orders: data.orders, fallback: data.model === "fallback" }]);
    } catch (err) {
      const text = err instanceof ApiRequestError && err.status === 429 ? err.message : t("error");
      setMessages((m) => [...m, { id: id + 1, from: "assistant", text, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (text && !busy) void send(text);
  };

  if (!allowed) {
    return (
      <div className="rounded-3xl border border-border bg-surface p-8 text-center">
        <Lock className="mx-auto size-8 text-foreground-muted" aria-hidden />
        <h1 className="mt-3 text-2xl">{t("restrictedTitle")}</h1>
        <p className="mt-1 text-sm text-foreground-secondary">{t("restrictedBody")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", status?.available ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
            <span className={cn("size-1.5 rounded-full", status?.available ? "bg-success" : "bg-warning")} />
            {status === null ? "…" : status.available ? t("online", { model: status.model }) : status.configured ? t("paused") : t("notConfigured")}
          </span>
        }
      />

      <section className="flex h-[min(720px,calc(100vh-14rem))] min-h-[460px] flex-col overflow-hidden rounded-2xl border border-border bg-surface">
        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite">
          {messages.length === 0 && (
            <div className="mx-auto max-w-2xl py-6 text-center">
              <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue dark:text-brand-blue-light">
                <Sparkles className="size-6" aria-hidden />
              </span>
              <p className="mt-3 text-base font-semibold text-foreground">{t("emptyTitle")}</p>
              <p className="mt-1 text-sm text-foreground-secondary">{t("emptyBody")}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((key) => (
                  <button key={key} type="button" onClick={() => void send(t(`suggestions.${key}`))} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground-secondary transition-colors hover:border-brand-blue hover:text-brand-blue">
                    {t(`suggestions.${key}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex flex-col gap-2", m.from === "user" ? "items-end" : "items-start")}>
              <p
                className={cn(
                  "max-w-[92%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[80%]",
                  m.from === "user" ? "rounded-br-md bg-brand-blue text-white" : m.error ? "rounded-bl-md bg-danger/10 text-danger" : m.fallback ? "rounded-bl-md border border-warning/40 bg-warning/10 text-foreground" : "rounded-bl-md bg-surface-hover text-foreground"
                )}
              >
                {m.from === "assistant" ? renderText(m.text) : m.text}
              </p>
              {m.orders && m.orders.length > 0 && (
                <ul className="grid w-full max-w-[92%] gap-1.5 sm:max-w-[80%] sm:grid-cols-2" aria-label={t("orders")}>
                  {m.orders.map((o) => (
                    <li key={o.id}>
                      <Link href={`/admin/orders/${o.id}`} className="flex h-full flex-col gap-1.5 rounded-xl border border-border bg-background p-3 transition-colors hover:border-brand-blue">
                        <span className="flex items-start justify-between gap-2">
                          <span className="min-w-0 truncate text-sm font-semibold text-foreground">{o.title}</span>
                          <ExternalLink className="mt-0.5 size-4 shrink-0 text-foreground-muted" aria-hidden />
                        </span>
                        <span className="text-xs text-foreground-muted">
                          #{o.shortId}
                          {o.reference && ` · ${o.reference}`} · {formatPrice(o.totalAmount, locale)} · {formatDate(o.createdAt, locale)}
                        </span>
                        <StatusPill status={o.status} label={to(`status.${o.status}`)} className="self-start" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {busy && (
            <p className="inline-flex items-center gap-2 rounded-2xl bg-surface-hover px-4 py-3 text-sm text-foreground-secondary">
              <Loader2 className="size-4 animate-spin" aria-hidden /> {t("thinking")}
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="border-t border-border p-3 sm:p-4">
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button type="button" onClick={() => setMessages([])} aria-label={t("reset")} title={t("reset")} className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border text-foreground-secondary hover:bg-surface-hover">
                <RotateCcw className="size-4" />
              </button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("placeholder")}
              aria-label={t("placeholder")}
              maxLength={2000}
              className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors focus:border-brand-blue"
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label={t("send")} className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-blue text-white transition-colors hover:bg-brand-blue-light disabled:opacity-50">
              <Send className="size-4" />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-foreground-muted">{t("footnote")}</p>
        </form>
      </section>
    </div>
  );
}
