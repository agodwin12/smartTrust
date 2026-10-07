"use client";

import { Check, CheckCheck, Loader2, RotateCcw, ShieldAlert } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Fragment } from "react";
import { Link } from "@/i18n/navigation";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatProductCard } from "@/types";

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function ProductCard({ product, mine }: { product: ChatProductCard; mine: boolean }) {
  const t = useTranslations("messaging");
  const locale = useLocale();
  const inner = (
    <>
      <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-hover">{product.image && <Image src={product.image} alt="" fill sizes="48px" className="object-cover" />}</span>
      <span className="min-w-0 text-left">
        <span className="line-clamp-2 text-[13px] font-semibold leading-snug">{product.title}</span>
        <span className={cn("block text-xs", mine ? "text-white/80" : "text-foreground-muted")}>{product.available ? formatPrice(product.price, locale) : t("productUnavailable")}</span>
      </span>
    </>
  );
  const cls = cn("mb-1.5 flex items-center gap-2.5 rounded-xl p-2", mine ? "bg-white/15" : "bg-background");
  return product.available ? (
    <Link href={`/products/${product.slug}`} className={cn(cls, "transition-opacity hover:opacity-90")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

type MessageListProps = {
  messages: ChatMessage[];
  /** Messages from this user are drawn on the right. */
  rightId: string | null;
  /** When the other side last read the conversation: "Seen" under the last right-hand message. */
  counterpartReadAt?: string | null;
  /** Staff view: sender names above each bubble, and a "flagged" mark instead of the warning. */
  names?: Record<string, string>;
  onRetry?: (message: ChatMessage) => void;
};

/** Bubbles grouped by day: text, photo, product card, delivery state and the off-platform payment warning. */
export function MessageList({ messages, rightId, counterpartReadAt, names, onRetry }: MessageListProps) {
  const t = useTranslations("messaging");
  const locale = useLocale();
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86_400_000);
  const lastMineIndex = messages.reduce((found, m, i) => (m.senderId === rightId && !m.pending ? i : found), -1);
  const seen = lastMineIndex >= 0 && !!counterpartReadAt && new Date(counterpartReadAt) >= new Date(messages[lastMineIndex].createdAt);

  return (
    <ol className="space-y-2">
      {messages.map((m, i) => {
        const date = new Date(m.createdAt);
        const newDay = i === 0 || !sameDay(date, new Date(messages[i - 1].createdAt));
        const mine = m.senderId === rightId;
        const dayLabel = sameDay(date, now) ? t("today") : sameDay(date, yesterday) ? t("yesterday") : formatDate(date, locale, { dateStyle: "medium" });
        return (
          <Fragment key={m.id}>
            {newDay && (
              <li className="flex justify-center py-2" aria-hidden={false}>
                <span className="rounded-full bg-surface-hover px-3 py-1 text-[11px] font-semibold text-foreground-muted">{dayLabel}</span>
              </li>
            )}
            <li className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
              {names && <span className="mb-0.5 px-1 text-[11px] font-semibold text-foreground-muted">{names[m.senderId] ?? "—"}</span>}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]",
                  mine ? "rounded-br-md bg-brand-blue text-white" : "rounded-bl-md bg-surface-hover text-foreground",
                  m.pending === "failed" && "opacity-70"
                )}
              >
                {m.advertisement && <ProductCard product={m.advertisement} mine={mine} />}
                {m.imageUrl && (
                  <a href={m.imageUrl} target="_blank" rel="noopener noreferrer" className="mb-1 block overflow-hidden rounded-xl">
                    {m.imageUrl.startsWith("blob:") ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local preview of a photo still uploading
                      <img src={m.imageUrl} alt={t("photo")} className="max-h-72 w-auto max-w-full object-contain" />
                    ) : (
                      <Image src={m.imageUrl} alt={t("photo")} width={480} height={480} sizes="(max-width: 640px) 80vw, 320px" className="h-auto max-h-72 w-auto max-w-full object-contain" />
                    )}
                  </a>
                )}
                {m.body && <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>}
              </div>
              <span className="mt-0.5 flex items-center gap-1 px-1 text-[11px] text-foreground-muted">
                {date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                {mine && m.pending === "sending" && <Loader2 className="size-3 animate-spin" aria-label={t("sending")} />}
                {mine && !m.pending && !names && (i === lastMineIndex && seen ? <CheckCheck className="size-3.5 text-brand-blue" aria-label={t("seen")} /> : <Check className="size-3.5" aria-hidden />)}
                {mine && i === lastMineIndex && seen && !names && <span>{t("seen")}</span>}
                {m.pending === "failed" && (
                  <button type="button" onClick={() => onRetry?.(m)} className="inline-flex items-center gap-1 font-semibold text-danger hover:underline">
                    {t("failed")} <RotateCcw className="size-3" aria-hidden /> {t("retry")}
                  </button>
                )}
              </span>
              {m.flagged &&
                (names ? (
                  <span className="mt-0.5 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">{t("flaggedTag")}</span>
                ) : (
                  !mine && (
                    <p role="note" className="mt-1 flex max-w-[85%] items-start gap-1.5 rounded-xl bg-warning/10 px-2.5 py-1.5 text-[12px] text-foreground sm:max-w-[70%]">
                      <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden /> {t("flaggedWarning")}
                    </p>
                  )
                ))}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
