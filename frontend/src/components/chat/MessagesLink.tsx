"use client";

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/features/auth/AuthProvider";
import { useChat } from "@/features/chat/ChatProvider";
import { Link } from "@/i18n/navigation";

/** Header shortcut to the inbox with the live unread count (signed-in visitors only). */
export function MessagesLink({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const t = useTranslations("nav");
  const { status } = useAuth();
  const { unread } = useChat();
  if (status !== "authenticated") return null;
  return (
    <Link href="/messages" aria-label={t("messagesCount", { count: unread })} className={className}>
      <MessageCircle className="size-5" aria-hidden />
      {withLabel && <span className="hidden xl:inline">{t("messages")}</span>}
      {unread > 0 && (
        <span className="absolute -right-0.5 top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-market-orange px-1 text-[10px] font-bold leading-4 text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
