"use client";

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ConversationList } from "@/components/chat/ConversationList";

/** Messages area: inbox + thread side by side on desktop; one at a time on phones. */
export function ChatShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeId = pathname.startsWith("/messages/") ? pathname.split("/")[2] : undefined;
  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className={cn(activeId && "hidden lg:block")}>
        <ConversationList activeId={activeId} />
      </aside>
      <section className={cn("min-w-0", !activeId && "hidden lg:block")}>{children}</section>
    </div>
  );
}

/** Desktop placeholder next to the inbox when no conversation is open. */
export function NoConversationSelected() {
  const t = useTranslations("messaging");
  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border bg-surface p-8 text-center">
      <MessageCircle className="size-8 text-foreground-muted" aria-hidden />
      <p className="font-semibold text-foreground">{t("select")}</p>
      <p className="max-w-sm text-sm text-foreground-secondary">{t("selectHint")}</p>
    </div>
  );
}
