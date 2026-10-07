"use client";

import { ArrowLeft, Eye, Loader2, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import type { ChatMessage, Conversation } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";
import { MessageList } from "@/components/chat/MessageList";
import { StatusPill } from "./primitives";

/** One conversation, read-only, for staff: both parties named, flagged messages marked. */
export function AdminConversationView({ id }: { id: string }) {
  const t = useTranslations("admin.messages");
  const { authFetch } = useAuth();
  const describeError = useAuthError();
  const [conversation, setConversation] = useState<Conversation | null | "missing">(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      authFetch<{ conversation: Conversation }>(`admin/conversations/${id}`),
      authFetch<{ items: ChatMessage[]; hasMore: boolean }>(`admin/conversations/${id}/messages`, { params: { limit: 100 } }),
    ])
      .then(([c, page]) => {
        if (cancelled) return;
        setConversation(c.conversation);
        setMessages(page.items);
        setHasMore(page.hasMore);
      })
      .catch(() => !cancelled && setConversation("missing"));
    return () => {
      cancelled = true;
    };
  }, [authFetch, id]);

  const loadEarlier = async () => {
    if (!messages[0]) return;
    setLoading(true);
    try {
      const page = await authFetch<{ items: ChatMessage[]; hasMore: boolean }>(`admin/conversations/${id}/messages`, { params: { before: messages[0].id, limit: 100 } });
      setMessages((prev) => [...page.items, ...prev]);
      setHasMore(page.hasMore);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  const back = (
    <Link href="/admin/messages" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline">
      <ArrowLeft className="size-4" aria-hidden /> {t("title")}
    </Link>
  );
  if (conversation === null) return <div className="h-96 animate-pulse rounded-3xl bg-surface-hover" />;
  if (conversation === "missing") return <div className="space-y-4">{back}<p className="text-foreground-secondary">{t("notFound")}</p></div>;

  const seller = conversation.seller;
  return (
    <div className="space-y-5">
      {back}
      <section className="rounded-3xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">{t("buyer")}</p>
              <p className="font-semibold text-foreground">{conversation.buyer.name}</p>
              <p className="text-xs text-foreground-muted">{conversation.buyer.email}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">{t("seller")}</p>
              <Link href={`/stores/${conversation.store.slug}`} className="font-semibold text-foreground hover:text-brand-blue">
                {conversation.store.name}
              </Link>
              {seller && <p className="text-xs text-foreground-muted">{seller.name} · {seller.email}</p>}
            </div>
          </div>
          {conversation.flagged && <StatusPill tone="warning" label={<span className="inline-flex items-center gap-1"><ShieldAlert className="size-3" aria-hidden /> {t("flagged")}</span>} />}
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-blue/5 px-3 py-2 text-xs text-foreground-secondary">
          <Eye className="mt-0.5 size-3.5 shrink-0 text-brand-blue" aria-hidden /> {t("readOnly")}
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-4 sm:p-5">
        {hasMore && (
          <div className="mb-3 flex justify-center">
            <button type="button" onClick={loadEarlier} disabled={loading} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold text-foreground-secondary hover:border-brand-blue hover:text-brand-blue disabled:opacity-60">
              {loading && <Loader2 className="size-3.5 animate-spin" aria-hidden />} {t("loadEarlier")}
            </button>
          </div>
        )}
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-foreground-muted">{t("noMessages")}</p>
        ) : (
          <MessageList
            messages={messages}
            rightId={seller?.id ?? null}
            names={{ [conversation.buyer.id]: `${conversation.buyer.name} · ${t("buyer")}`, ...(seller && { [seller.id]: `${conversation.store.name} · ${t("seller")}` }) }}
          />
        )}
      </section>
    </div>
  );
}
