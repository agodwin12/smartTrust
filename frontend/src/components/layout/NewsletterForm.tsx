"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";

export function NewsletterForm({ className }: { className?: string }) {
  const t = useTranslations("footer.newsletter");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    // Backend endpoint lands with the marketing module; the UI contract is final.
    setDone(true);
  };

  if (done) {
    return (
      <p className={cn("flex items-center gap-2 text-sm font-medium text-success", className)}>
        <Check className="size-4" />
        {t("success")}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className={cn("flex flex-col gap-2 sm:flex-row", className)}>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("placeholder")}
        aria-label={t("placeholder")}
        className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-foreground-muted focus:border-brand-blue focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand-blue)_18%,transparent)]"
      />
      <button
        type="submit"
        className="h-11 shrink-0 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-light"
      >
        {t("button")}
      </button>
    </form>
  );
}
