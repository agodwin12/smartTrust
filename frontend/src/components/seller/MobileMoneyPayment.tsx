"use client";

import { CheckCircle2, Loader2, ShieldCheck, Smartphone, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ApiRequestError } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export const PROVIDERS = ["MTN_MOMO_CMR", "ORANGE_CMR"] as const;
export type Provider = (typeof PROVIDERS)[number];

type Phase = "form" | "starting" | "waiting" | "success" | "failed";

type MobileMoneyPaymentProps = {
  amount: number;
  defaultPhone?: string | null;
  /** Start the payment; resolve with the id to poll. */
  onStart: (provider: Provider, phoneNumber: string) => Promise<string>;
  /** Poll the payment; resolve "pending" until it settles. */
  onPoll: (pollId: string) => Promise<"pending" | "success" | "failed">;
  onSuccess?: () => void;
  successTitle: string;
  successContent?: ReactNode;
  pollMs?: number;
  timeoutMs?: number;
};

const field =
  "h-12 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-foreground-muted focus:border-brand-blue focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand-blue)_18%,transparent)]";

/** Shared Mobile Money flow: operator + number → USSD prompt → polling → settled. Used for plans (and reusable for orders). */
export function MobileMoneyPayment({ amount, defaultPhone, onStart, onPoll, onSuccess, successTitle, successContent, pollMs = 4000, timeoutMs = 180_000 }: MobileMoneyPaymentProps) {
  const t = useTranslations("sellerArea.payment");
  const tc = useTranslations("checkout");
  const locale = useLocale();
  const [phase, setPhase] = useState<Phase>("form");
  const [provider, setProvider] = useState<Provider>("MTN_MOMO_CMR");
  const [phone, setPhone] = useState(defaultPhone?.replace(/^\+?237/, "") ?? "");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearInterval(timer.current), []);

  const poll = (id: string) => {
    const startedAt = Date.now();
    window.clearInterval(timer.current);
    timer.current = window.setInterval(async () => {
      try {
        const result = await onPoll(id);
        if (result !== "pending") {
          window.clearInterval(timer.current);
          setPhase(result);
          if (result === "success") onSuccess?.();
          return;
        }
      } catch {
        /* transient */
      }
      if (Date.now() - startedAt > timeoutMs) {
        window.clearInterval(timer.current);
        setPhase("failed");
      }
    }, pollMs);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPhase("starting");
    try {
      const digits = phone.replace(/\D/g, "");
      const id = await onStart(provider, digits.startsWith("237") ? digits : `237${digits}`);
      setPhase("waiting");
      poll(id);
    } catch (err) {
      setError(t("error", { message: err instanceof ApiRequestError ? err.message : "" }));
      setPhase("form");
    }
  };

  if (phase === "success") {
    return (
      <div className="py-6 text-center">
        <CheckCircle2 className="mx-auto size-14 text-success" />
        <h2 className="mt-4 text-2xl">{successTitle}</h2>
        {successContent && <div className="mt-4">{successContent}</div>}
      </div>
    );
  }
  if (phase === "failed") {
    return (
      <div className="py-6 text-center">
        <XCircle className="mx-auto size-14 text-danger" />
        <p className="mx-auto mt-4 max-w-md text-sm text-foreground-secondary">{t("failed")}</p>
        <button type="button" onClick={() => setPhase("form")} className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand-orange px-5 text-sm font-semibold text-white hover:bg-brand-orange-light">
          {t("retry")}
        </button>
      </div>
    );
  }
  if (phase === "waiting") {
    return (
      <div className="py-6 text-center">
        <span className="relative mx-auto inline-flex size-16 items-center justify-center rounded-full bg-brand-sky/70 text-brand-blue dark:bg-surface-elevated">
          <Smartphone className="size-7" />
          <Loader2 className="absolute -right-1 -top-1 size-6 animate-spin text-brand-orange" />
        </span>
        <p className="mx-auto mt-4 max-w-md text-sm text-foreground-secondary">{t("waiting", { amount: formatPrice(amount, locale) })}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">{t("provider")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <label
              key={p}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors",
                provider === p ? "border-brand-blue bg-brand-sky/40 dark:bg-surface-hover" : "border-border hover:border-brand-blue/50"
              )}
            >
              <input type="radio" name="provider" value={p} checked={provider === p} onChange={() => setProvider(p)} className="accent-brand-blue" />
              <span className={cn("inline-flex size-9 items-center justify-center rounded-lg text-xs font-bold", p === "MTN_MOMO_CMR" ? "bg-[#FFCC00] text-black" : "bg-[#FF7900] text-white")}>
                {p === "MTN_MOMO_CMR" ? "MTN" : "OM"}
              </span>
              <span className="text-sm font-semibold text-foreground">{tc(p)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-medium text-foreground">
        {t("phone")}
        <div className="mt-1.5 flex">
          <span className="inline-flex h-12 items-center rounded-l-xl border border-r-0 border-border bg-surface-hover px-3 text-sm text-foreground-secondary">+237</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required minLength={8} placeholder="6XX XXX XXX" className={`${field} rounded-l-none`} />
        </div>
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={phase === "starting"} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-orange text-sm font-semibold text-white hover:bg-brand-orange-light disabled:opacity-60">
        {phase === "starting" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
        {phase === "starting" ? t("processing") : t("pay", { amount: formatPrice(amount, locale) })}
      </button>
    </form>
  );
}
