"use client";

import { Bot, ExternalLink, Headset, MessageCircle, RotateCcw, Send, X } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { ApiRequestError } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";

type ProductCard = {
  id: string;
  title: string;
  slug: string;
  price: string;
  compareAtPrice: string | null;
  image: string | null;
  store: { name: string; slug: string } | null;
};

type OrderCard = { id: string; title: string; slug: string | null; image: string | null; status: OrderStatus; totalAmount: string; createdAt: string };

type ChatReply = { reply: string; products: ProductCard[]; orders: OrderCard[] };

type Message = { id: number; from: "assistant" | "user"; text: string; products?: ProductCard[]; orders?: OrderCard[]; tone?: "error" };

const CHIPS = [
  { key: "find", href: "/categories" },
  { key: "track", href: "/account/orders" },
  { key: "escrow", href: "/how-it-works#escrow" },
  { key: "seller", href: "/sell" },
  { key: "plans", href: "/subscriptions" },
] as const;

const HISTORY_LIMIT = 12;

/** Spec 23: bottom-right launcher, gentle idle pulse every ~10s, panel scales 0.96→1. */
export function ChatLauncher({ whatsappUrl = null }: { whatsappUrl?: string | null }) {
  const t = useTranslations("chat");
  const to = useTranslations("orders");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const { authFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"ai" | "basic">("basic");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages, busy, open, reduceMotion]);

  // Ask once, on first open, whether the assistant is configured server-side.
  useEffect(() => {
    if (!open || enabled !== null) return;
    let cancelled = false;
    authFetch<{ enabled: boolean; mode?: "ai" | "basic" }>("assistant/status")
      .then((r) => {
        if (cancelled) return;
        setEnabled(r.enabled);
        setMode(r.mode ?? "ai");
      })
      .catch(() => !cancelled && setEnabled(false));
    return () => {
      cancelled = true;
    };
  }, [open, enabled, authFetch]);

  const send = async (text: string) => {
    const id = Date.now();
    const next: Message[] = [...messages, { id, from: "user", text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const history = next
        .filter((m) => m.tone !== "error")
        .slice(-HISTORY_LIMIT)
        .map((m) => ({ role: m.from, content: m.text }));
      // The API wants the transcript to start with the user — drop a leading assistant turn if the window cut there.
      while (history.length && history[0].role !== "user") history.shift();
      const data = await authFetch<ChatReply>("assistant/chat", { method: "POST", body: { messages: history, locale } });
      setMessages((m) => [...m, { id: id + 1, from: "assistant", text: data.reply, products: data.products, orders: data.orders }]);
    } catch (err) {
      const offline = err instanceof ApiRequestError && (err.code === "ASSISTANT_UNAVAILABLE" || err.status === 503);
      if (offline) setEnabled(false);
      const text = offline ? t("offline") : err instanceof ApiRequestError && err.status === 429 ? err.message : t("error");
      setMessages((m) => [...m, { id: id + 1, from: "assistant", text, tone: "error" }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    void send(text);
  };

  const offline = enabled === false;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            role="dialog"
            aria-label={t("title")}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed inset-x-3 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-50 flex h-[min(600px,76vh)] lg:bottom-24 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_32px_64px_-24px_rgba(0,0,0,0.5)] sm:inset-x-auto sm:right-5 sm:w-[400px]"
          >
            <div className="flex items-center gap-3 border-b border-border bg-surface-elevated px-4 py-3">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-brand-blue text-white">
                <Bot className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{t("title")}</p>
                <p className="flex items-center gap-1.5 text-xs text-foreground-muted">
                  <span className={cn("inline-block size-1.5 rounded-full", offline ? "bg-foreground-muted" : "bg-success")} />
                  {offline ? t("offlineStatus") : t("status")}
                </p>
              </div>
              {messages.length > 0 && (
                <button type="button" onClick={() => setMessages([])} aria-label={t("reset")} title={t("reset")} className="inline-flex size-8 items-center justify-center rounded-full text-foreground-secondary hover:bg-surface-hover hover:text-foreground">
                  <RotateCcw className="size-4" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} className="inline-flex size-8 items-center justify-center rounded-full text-foreground-secondary hover:bg-surface-hover hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              <Bubble from="assistant">{t("greeting")}</Bubble>
              {offline && messages.length === 0 && (
                <Bubble from="assistant" tone="error">
                  {t("offline")}
                </Bubble>
              )}
              {messages.map((m) => (
                <div key={m.id} className="space-y-2">
                  <Bubble from={m.from} tone={m.tone} onNavigate={() => setOpen(false)}>
                    {m.text}
                  </Bubble>
                  {m.products && m.products.length > 0 && (
                    <ul className="space-y-1.5" aria-label={t("products")}>
                      {m.products.map((p) => (
                        <li key={p.id}>
                          <Link href={`/products/${p.slug}`} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl border border-border bg-background p-2 transition-colors hover:border-brand-blue">
                            <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-hover">{p.image && <Image src={p.image} alt="" fill sizes="48px" className="object-cover" />}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-foreground">{p.title}</span>
                              <span className="flex items-baseline gap-1.5">
                                <span className="font-bold text-base text-brand-blue dark:text-brand-blue-light">{formatPrice(p.price, locale)}</span>
                                {p.compareAtPrice && <span className="text-xs text-foreground-muted line-through">{formatPrice(p.compareAtPrice, locale)}</span>}
                              </span>
                              {p.store && <span className="block truncate text-xs text-foreground-muted">{p.store.name}</span>}
                            </span>
                            <ExternalLink className="size-4 shrink-0 text-foreground-muted" aria-label={t("viewProduct")} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.orders && m.orders.length > 0 && (
                    <ul className="space-y-1.5" aria-label={t("orders")}>
                      {m.orders.map((o) => (
                        <li key={o.id}>
                          <Link href={`/account/orders/${o.id}`} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl border border-border bg-background p-2 transition-colors hover:border-brand-blue">
                            <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-hover">{o.image && <Image src={o.image} alt="" fill sizes="48px" className="object-cover" />}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-foreground">{o.title}</span>
                              <span className="block text-xs text-foreground-muted">
                                {to(`status.${o.status}`)} · {formatPrice(o.totalAmount, locale)} · {formatDate(o.createdAt, locale)}
                              </span>
                            </span>
                            <ExternalLink className="size-4 shrink-0 text-foreground-muted" aria-label={t("viewOrder")} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {busy && (
                <div className="flex justify-start" aria-label={t("typing")}>
                  <span className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-surface-hover px-3.5 py-3">
                    {[0, 1, 2].map((i) => (
                      <motion.span key={i} className="size-1.5 rounded-full bg-foreground-muted" animate={reduceMotion ? undefined : { opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }} />
                    ))}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
              {CHIPS.map((chip) => (
                <Link key={chip.key} href={chip.href} onClick={() => setOpen(false)} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground-secondary transition-colors hover:border-brand-blue hover:text-brand-blue dark:hover:text-brand-blue-light">
                  {t(`chips.${chip.key}`)}
                </Link>
              ))}
              <a
                href={whatsappUrl ?? "/help/contact"}
                target={whatsappUrl ? "_blank" : undefined}
                rel={whatsappUrl ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#25D366]/50 bg-[#25D366]/10 px-3 py-1.5 text-xs font-semibold text-[#128C4B] transition-colors hover:bg-[#25D366]/20 dark:text-[#4ADE80]"
              >
                <Headset className="size-3.5" aria-hidden /> {t("chips.human")}
              </a>
            </div>

            <form onSubmit={onSubmit} className="border-t border-border p-3">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t("placeholder")}
                  aria-label={t("placeholder")}
                  disabled={offline}
                  maxLength={2000}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-foreground-muted focus:border-brand-blue focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand-blue)_18%,transparent)] disabled:opacity-60"
                />
                <button type="submit" aria-label={t("send")} disabled={busy || offline || !input.trim()} className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange text-white transition-colors hover:bg-brand-orange-light disabled:opacity-50">
                  <Send className="size-4" />
                </button>
              </div>
              <p className="mt-2 text-[10px] leading-snug text-foreground-muted">{mode === "ai" ? t("disclaimer") : t("disclaimerBasic")}</p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? t("close") : t("open")}
        whileHover={reduceMotion ? undefined : { scale: 1.05 }}
        whileTap={reduceMotion ? undefined : { scale: 0.95 }}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-50 inline-flex size-14 lg:bottom-5 lg:right-5 items-center justify-center rounded-full bg-brand-blue text-white shadow-[0_16px_32px_-12px_color-mix(in_oklab,var(--brand-blue)_70%,transparent)] transition-shadow hover:shadow-[0_20px_40px_-12px_color-mix(in_oklab,var(--brand-blue)_80%,transparent)]"
      >
        {!open && !reduceMotion && (
          <motion.span aria-hidden className="absolute inset-0 rounded-full bg-brand-blue" animate={{ scale: [1, 1.55], opacity: [0.45, 0] }} transition={{ duration: 1.3, ease: "easeOut", repeat: Infinity, repeatDelay: 9 }} />
        )}
        <span className="relative inline-flex">
          {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
          {!open && <span className="absolute -right-1.5 -top-1.5 size-2.5 rounded-full bg-brand-orange ring-2 ring-brand-blue" />}
        </span>
      </motion.button>
    </>
  );
}

// Site paths (/deals, /products/x, /search?q=…) and web links (https://wa.me/…) in assistant replies.
const LINK_PATTERN = /(https?:\/\/[^\s)]+|(?<![\w/])\/[a-z][\w\-/]*(?:\?[\w=%&+\-.]*)?(?:#[\w-]+)?)/gi;

function linkify(text: string, onNavigate?: () => void) {
  const parts = text.split(LINK_PATTERN);
  return parts.map((part, i) => {
    if (i % 2 === 0) return part;
    const clean = part.replace(/[.,;:!?]+$/, "");
    const tail = part.slice(clean.length);
    const link = clean.startsWith("http") ? (
      <a key={i} href={clean} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
        {clean.replace(/^https?:\/\//, "")}
      </a>
    ) : (
      <Link key={i} href={clean} onClick={onNavigate} className="font-semibold underline underline-offset-2">
        {clean}
      </Link>
    );
    return tail ? [link, tail] : link;
  });
}

function Bubble({ from, tone, children, onNavigate }: { from: Message["from"]; tone?: "error"; children: React.ReactNode; onNavigate?: () => void }) {
  return (
    <div className={cn("flex", from === "user" ? "justify-end" : "justify-start")}>
      <p className={cn("max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", from === "user" ? "rounded-br-md bg-brand-blue text-white" : tone === "error" ? "rounded-bl-md bg-danger/10 text-danger" : "rounded-bl-md bg-surface-hover text-foreground")}>
        {from === "assistant" && typeof children === "string" ? linkify(children, onNavigate) : children}
      </p>
    </div>
  );
}
