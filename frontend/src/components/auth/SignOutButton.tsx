"use client";

import { Loader2, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSignOut } from "@/features/auth/useSignOut";
import { cn } from "@/lib/utils";

/** "Sign out" for the account, seller and admin navigations. */
export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const { signOut, pending } = useSignOut();
  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={pending}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-medium text-foreground-secondary transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-60 lg:w-full",
        className
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />} {t("signOut")}
    </button>
  );
}
