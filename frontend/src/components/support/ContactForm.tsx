"use client";

import { CheckCircle2, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";

const field =
  "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-foreground-muted focus:border-brand-blue focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand-blue)_18%,transparent)]";

export function ContactForm() {
  const t = useTranslations("contact");
  const locale = useLocale();
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSending(true);
    try {
      await apiFetch("support/contact", {
        method: "POST",
        body: {
          name: form.get("name"),
          email: form.get("email"),
          subject: form.get("subject"),
          message: form.get("message"),
          website: form.get("website") || undefined,
          locale,
        },
      });
      setDone(true);
    } catch {
      toast.error(t("error"));
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/10 p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <h3 className="mt-3 font-sans text-lg font-semibold text-foreground">{t("success.title")}</h3>
        <p className="mt-1 text-sm text-foreground-secondary">{t("success.description")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-foreground">
          {t("name")}
          <input name="name" required minLength={2} defaultValue={user ? `${user.firstName} ${user.lastName}` : ""} className={`${field} mt-1.5`} />
        </label>
        <label className="block text-sm font-medium text-foreground">
          {t("email")}
          <input name="email" type="email" required defaultValue={user?.email ?? ""} className={`${field} mt-1.5`} />
        </label>
      </div>
      <label className="block text-sm font-medium text-foreground">
        {t("subject")}
        <input name="subject" required minLength={3} className={`${field} mt-1.5`} />
      </label>
      <label className="block text-sm font-medium text-foreground">
        {t("message")}
        <textarea name="message" required minLength={10} rows={6} className={`${field} mt-1.5 h-auto py-3`} />
      </label>
      {/* Honeypot: hidden from people, filled by bots, rejected by the API. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <button
        type="submit"
        disabled={sending}
        className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-blue px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-light disabled:opacity-60"
      >
        <Send className="size-4" /> {t("submit")}
      </button>
    </form>
  );
}
