"use client";

import { ArrowLeft, ImagePlus, Loader2, SendHorizontal, ShieldCheck, Store as StoreIcon, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { useChat, type NewMessageEvent, type ReadEvent, type TypingEvent } from "@/features/chat/ChatProvider";
import { Link } from "@/i18n/navigation";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChatMessage, Conversation } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";
import { MessageList } from "@/components/chat/MessageList";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_CHARS = 2000;

/** Who the viewer is talking to: the store (as a buyer) or the customer (as the seller). */
export function counterpartOf(c: Conversation) {
  return c.side === "seller" ? { name: c.buyer.name, logo: null as string | null, href: null as string | null } : { name: c.store.name, logo: c.store.logoUrl, href: `/stores/${c.store.slug}` };
}

/** One conversation: header, messages (live), the escrow reminder and the composer (text, photo, product). */
export function ChatThread({ conversationId }: { conversationId: string }) {
  const t = useTranslations("messaging");
  const { user, authFetch } = useAuth();
  const { on, typing, refreshUnread } = useChat();
  const describeError = useAuthError();
  const productParam = useSearchParams().get("product");

  const [conversation, setConversation] = useState<Conversation | null | "missing">(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [attachProduct, setAttachProduct] = useState(true);
  const [counterpartTyping, setCounterpartTyping] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const keepOffset = useRef<number | null>(null);
  const retryFiles = useRef(new Map<string, File>());
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markRead = useCallback(() => {
    authFetch(`conversations/${conversationId}/read`, { method: "POST" })
      .then(refreshUnread)
      .catch(() => {});
  }, [authFetch, conversationId, refreshUnread]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      authFetch<{ conversation: Conversation }>(`conversations/${conversationId}`),
      authFetch<{ items: ChatMessage[]; hasMore: boolean }>(`conversations/${conversationId}/messages`, { params: { limit: 40 } }),
    ])
      .then(([c, page]) => {
        if (cancelled) return;
        stickToBottom.current = true;
        setConversation(c.conversation);
        setMessages(page.items);
        setHasMore(page.hasMore);
        if (c.conversation.unread > 0) markRead();
      })
      .catch(() => !cancelled && setConversation("missing"));
    return () => {
      cancelled = true;
    };
  }, [authFetch, conversationId, markRead]);

  // Live: new messages (from the other side, or this account in another tab), "Seen", "typing…".
  useEffect(() => {
    const offNew = on<NewMessageEvent>("message:new", (e) => {
      if (e.conversationId !== conversationId) return;
      const incoming = e.message;
      setMessages((prev) => {
        const at = prev.findIndex((m) => m.id === incoming.id || (!!incoming.clientId && m.clientId === incoming.clientId));
        if (at === -1) return [...prev, incoming];
        const next = [...prev];
        next[at] = incoming;
        return next;
      });
      if (incoming.senderId !== user?.id) {
        setCounterpartTyping(false);
        if (document.visibilityState === "visible") markRead();
      }
    });
    const offRead = on<ReadEvent>("conversation:read", (e) => {
      if (e.conversationId !== conversationId) return;
      setConversation((c) => (c && c !== "missing" && e.side !== c.side ? { ...c, counterpartReadAt: e.at } : c));
    });
    const offTyping = on<TypingEvent>("typing", (e) => {
      if (e.conversationId !== conversationId || e.userId === user?.id) return;
      setCounterpartTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setCounterpartTyping(false), 3500);
    });
    return () => {
      offNew();
      offRead();
      offTyping();
    };
  }, [on, conversationId, user?.id, markRead]);

  // Coming back to the tab reads what arrived meanwhile.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && markRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markRead]);

  // Stay at the bottom for new messages; keep the reading position when older ones are loaded above.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (keepOffset.current !== null) {
      el.scrollTop = el.scrollHeight - keepOffset.current;
      keepOffset.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, counterpartTyping]);

  const onScroll = () => {
    const el = scroller.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const loadEarlier = async () => {
    const first = messages.find((m) => !m.pending);
    if (!first || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const page = await authFetch<{ items: ChatMessage[]; hasMore: boolean }>(`conversations/${conversationId}/messages`, { params: { before: first.id, limit: 40 } });
      if (scroller.current) keepOffset.current = scroller.current.scrollHeight - scroller.current.scrollTop;
      setMessages((prev) => [...page.items, ...prev]);
      setHasMore(page.hasMore);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setLoadingEarlier(false);
    }
  };

  if (conversation === null) return <div className="h-[70dvh] animate-pulse rounded-3xl bg-surface-hover" />;
  if (conversation === "missing") {
    return (
      <div className="rounded-3xl border border-border bg-surface p-8 text-center">
        <p className="text-foreground-secondary">{t("notFound")}</p>
        <Link href="/messages" className="mt-4 inline-flex text-sm font-semibold text-brand-blue hover:underline">
          {t("back")}
        </Link>
      </div>
    );
  }

  const counterpart = counterpartOf(conversation);
  // The product the buyer came from, offered as a card on their next message.
  const product = conversation.side === "buyer" && attachProduct && productParam && conversation.advertisement?.id === productParam ? conversation.advertisement : null;
  const canWrite = conversation.storeAvailable;

  const choosePhoto = (file: File | undefined) => {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return void toast.error(t("photoType"));
    if (file.size > MAX_PHOTO_BYTES) return void toast.error(t("photoTooLarge"));
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto({ file, url: URL.createObjectURL(file) });
  };

  const deliver = async (draft: ChatMessage, file: File | undefined) => {
    try {
      let saved: ChatMessage;
      if (file) {
        const form = new FormData();
        form.append("clientId", draft.clientId!);
        if (draft.body) form.append("body", draft.body);
        if (draft.advertisement) form.append("advertisementId", draft.advertisement.id);
        form.append("image", file);
        ({ message: saved } = await authFetch<{ message: ChatMessage }>(`conversations/${conversationId}/messages`, { method: "POST", body: form }));
      } else {
        ({ message: saved } = await authFetch<{ message: ChatMessage }>(`conversations/${conversationId}/messages`, {
          method: "POST",
          body: { body: draft.body ?? undefined, clientId: draft.clientId, advertisementId: draft.advertisement?.id },
        }));
      }
      retryFiles.current.delete(draft.clientId!);
      setMessages((prev) => prev.map((m) => (m.clientId === draft.clientId ? saved : m)));
      if (draft.imageUrl?.startsWith("blob:")) URL.revokeObjectURL(draft.imageUrl);
    } catch (err) {
      setMessages((prev) => prev.map((m) => (m.clientId === draft.clientId ? { ...m, pending: "failed" } : m)));
      toast.error(describeError(err));
    }
  };

  const send = (event?: FormEvent) => {
    event?.preventDefault();
    const body = text.trim();
    if (!user || (!body && !photo && !product) || body.length > MAX_CHARS) return;
    const clientId = crypto.randomUUID();
    const draft: ChatMessage = {
      id: `local-${clientId}`,
      conversationId,
      senderId: user.id,
      body: body || null,
      imageUrl: photo?.url ?? null,
      advertisement: product ?? null,
      flagged: false,
      clientId,
      createdAt: new Date().toISOString(),
      pending: "sending",
    };
    if (photo) retryFiles.current.set(clientId, photo.file);
    stickToBottom.current = true;
    setMessages((prev) => [...prev, draft]);
    setText("");
    setPhoto(null);
    if (product) setAttachProduct(false);
    void deliver(draft, photo?.file);
  };

  const retry = (m: ChatMessage) => {
    setMessages((prev) => prev.map((x) => (x.clientId === m.clientId ? { ...x, pending: "sending" } : x)));
    void deliver({ ...m, pending: "sending" }, retryFiles.current.get(m.clientId!));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends on a computer; on a phone the keyboard's return key adds a line.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) send(e as unknown as FormEvent);
  };

  const onType = (value: string) => {
    setText(value);
    const now = Date.now();
    if (value && now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now;
      typing(conversationId);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-13.5rem)] min-h-[440px] flex-col overflow-hidden rounded-3xl border border-border bg-surface lg:h-[calc(100dvh-11rem)]">
      <header className="flex items-center gap-3 border-b border-border px-3 py-3 sm:px-4">
        <Link href="/messages" aria-label={t("back")} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-foreground-secondary hover:bg-surface-hover lg:hidden">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-blue/10 text-xs font-bold text-brand-blue dark:text-brand-blue-light">
          {counterpart.logo ? <Image src={counterpart.logo} alt="" fill sizes="40px" className="object-cover" /> : initials(counterpart.name)}
        </span>
        <div className="min-w-0 flex-1">
          {counterpart.href ? (
            <Link href={counterpart.href} className="block truncate font-semibold text-foreground hover:text-brand-blue">
              {counterpart.name}
            </Link>
          ) : (
            <p className="truncate font-semibold text-foreground">{counterpart.name}</p>
          )}
          <p className="truncate text-xs text-foreground-muted">{counterpartTyping ? t("typing") : conversation.side === "seller" ? t("customerTag") : t("storeTag")}</p>
        </div>
        {conversation.side === "buyer" && (
          <Link href={`/stores/${conversation.store.slug}`} className="hidden h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:border-brand-blue hover:text-brand-blue sm:inline-flex">
            <StoreIcon className="size-3.5" aria-hidden /> {t("viewStore")}
          </Link>
        )}
      </header>

      <p className="flex items-start gap-2 border-b border-border bg-brand-blue/5 px-4 py-2 text-[12px] text-foreground-secondary">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden /> {t("safety")}
      </p>

      <div ref={scroller} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-4 sm:px-4" aria-live="polite">
        {hasMore && (
          <div className="mb-3 flex justify-center">
            <button type="button" onClick={loadEarlier} disabled={loadingEarlier} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold text-foreground-secondary hover:border-brand-blue hover:text-brand-blue disabled:opacity-60">
              {loadingEarlier && <Loader2 className="size-3.5 animate-spin" aria-hidden />} {t("loadEarlier")}
            </button>
          </div>
        )}
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-foreground-muted">{conversation.side === "buyer" ? t("firstMessage", { store: conversation.store.name }) : t("noMessages")}</p>
        ) : (
          <MessageList messages={messages} rightId={user?.id ?? null} counterpartReadAt={conversation.counterpartReadAt} onRetry={retry} />
        )}
        {counterpartTyping && <p className="mt-2 px-1 text-xs italic text-foreground-muted">{t("typing")}</p>}
      </div>

      {canWrite ? (
        <form onSubmit={send} className="border-t border-border p-2.5 sm:p-3">
          {(product || photo) && (
            <div className="mb-2 flex flex-wrap gap-2">
              {product && (
                <span className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-background py-1 pl-1 pr-2 text-xs">
                  <span className="relative size-8 shrink-0 overflow-hidden rounded-lg bg-surface-hover">{product.image && <Image src={product.image} alt="" fill sizes="32px" className="object-cover" />}</span>
                  <span className="min-w-0 truncate">{t("about", { title: product.title })}</span>
                  <button type="button" onClick={() => setAttachProduct(false)} aria-label={t("removeProduct")} className="text-foreground-muted hover:text-foreground">
                    <X className="size-3.5" />
                  </button>
                </span>
              )}
              {photo && (
                <span className="relative inline-block size-16 overflow-hidden rounded-xl border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview before upload */}
                  <img src={photo.url} alt={t("photo")} className="size-full object-cover" />
                  <button type="button" onClick={() => (URL.revokeObjectURL(photo.url), setPhoto(null))} aria-label={t("removePhoto")} className="absolute right-0.5 top-0.5 inline-flex size-5 items-center justify-center rounded-full bg-background/90 text-foreground shadow">
                    <X className="size-3" />
                  </button>
                </span>
              )}
            </div>
          )}
          <div className="flex items-end gap-2">
            <label className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-foreground-secondary transition-colors hover:bg-surface-hover hover:text-brand-blue" title={t("attachPhoto")}>
              <ImagePlus className="size-5" aria-hidden />
              <span className="sr-only">{t("attachPhoto")}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => (choosePhoto(e.target.files?.[0]), (e.target.value = ""))} />
            </label>
            <textarea
              value={text}
              onChange={(e) => onType(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={MAX_CHARS}
              placeholder={t("placeholder")}
              aria-label={t("placeholder")}
              className="max-h-36 min-h-11 flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none [field-sizing:content] placeholder:text-foreground-muted focus:border-brand-blue"
            />
            <button type="submit" disabled={!text.trim() && !photo && !product} aria-label={t("send")} className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-orange text-white transition-colors hover:bg-brand-orange-light disabled:opacity-50">
              <SendHorizontal className="size-5" aria-hidden />
            </button>
          </div>
        </form>
      ) : (
        <p className={cn("border-t border-border px-4 py-3 text-center text-sm text-foreground-muted")}>{t("unavailable")}</p>
      )}
    </div>
  );
}
