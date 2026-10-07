"use client";

import { Loader2, MessageCircle, MessagesSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";

type ChatButtonProps = {
  /** The product the buyer asks about (preferred: it shows as a card in the chat). */
  advertisementId?: string;
  /** The store; also used to hide the button on the owner's own store. */
  storeId: string;
  label?: string;
  className?: string;
};

/** "Chat with the seller": opens (or reopens) the buyer's conversation with the store. Sign-in first if needed. */
export function ChatButton({ advertisementId, storeId, label, className }: ChatButtonProps) {
  const t = useTranslations("messaging");
  const { status, user, authFetch } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const describeError = useAuthError();
  const [busy, setBusy] = useState(false);

  if (user?.store?.id === storeId) return null; // sellers don't message their own store

  const start = async () => {
    if (status !== "authenticated") return router.push(`/login?next=${encodeURIComponent(pathname)}`);
    setBusy(true);
    try {
      const { conversation } = await authFetch<{ conversation: Conversation }>("conversations", {
        method: "POST",
        body: advertisementId ? { advertisementId } : { storeId },
      });
      router.push(`/messages/${conversation.id}${advertisementId ? `?product=${advertisementId}` : ""}`);
    } catch (err) {
      toast.error(describeError(err));
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-foreground transition-colors hover:border-brand-blue hover:text-brand-blue disabled:opacity-60",
        className
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : advertisementId ? <MessageCircle className="size-4" aria-hidden /> : <MessagesSquare className="size-4" aria-hidden />}
      {label ?? t("startChat")}
    </button>
  );
}
