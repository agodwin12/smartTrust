"use client";

import { Loader2, RefreshCw, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Paginated, SellerDashboard, Withdrawal, WithdrawalStatus } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";
import { PROVIDERS, type Provider } from "@/components/seller/MobileMoneyPayment";

const STATUS_STYLES: Record<WithdrawalStatus, string> = {
  PENDING: "bg-warning/15 text-warning",
  PROCESSING: "bg-brand-blue/10 text-brand-blue",
  COMPLETED: "bg-success/15 text-success",
  FAILED: "bg-danger/10 text-danger",
  CANCELLED: "bg-foreground-muted/15 text-foreground-muted",
};

const field =
  "h-12 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-foreground-muted focus:border-brand-blue focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand-blue)_18%,transparent)]";

export function WalletView() {
  const t = useTranslations("sellerArea.wallet");
  const tp = useTranslations("sellerArea.payment");
  const tc = useTranslations("checkout");
  const locale = useLocale();
  const { user, authFetch } = useAuth();
  const describeError = useAuthError();
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<Withdrawal[] | null>(null);
  const [provider, setProvider] = useState<Provider>("MTN_MOMO_CMR");
  const [phone, setPhone] = useState(user?.phone?.replace(/^\+?237/, "") ?? "");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [dash, list] = await Promise.all([
      authFetch<{ store: SellerDashboard }>("stores/me").then((r) => Number(r.store.wallet?.balance ?? 0)).catch(() => 0),
      authFetch<Paginated<Withdrawal>>("withdrawals/me", { params: { pageSize: 50 } }).then((r) => r.items).catch(() => []),
    ]);
    setBalance(dash);
    setHistory(list);
  }, [authFetch]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void load();
  }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (balance !== null && value > balance) {
      toast.error(t("insufficient"));
      return;
    }
    setBusy(true);
    try {
      const digits = phone.replace(/\D/g, "");
      await authFetch("withdrawals", { method: "POST", body: { provider, phoneNumber: digits.startsWith("237") ? digits : `237${digits}`, amount: value } });
      toast.success(t("requested"));
      setAmount("");
      await load();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const refresh = async (id: string) => {
    try {
      const { withdrawal } = await authFetch<{ withdrawal: Withdrawal }>(`withdrawals/${id}/refresh`);
      setHistory((prev) => prev?.map((w) => (w.id === id ? withdrawal : w)) ?? prev);
    } catch {
      /* keep */
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground-secondary">{t("subtitle")}</p>
      </div>

      <section className="flex items-center gap-4 rounded-3xl bg-[linear-gradient(135deg,var(--brand-blue),color-mix(in_oklab,var(--brand-blue)_70%,#0b1220))] p-6 text-white">
        <Wallet className="size-8 shrink-0 text-brand-orange-light" />
        <div>
          <p className="text-xs uppercase tracking-wider text-white/70">{t("balance")}</p>
          <p className="font-bold text-4xl">{balance === null ? "…" : formatPrice(balance, locale)}</p>
        </div>
      </section>

      <form onSubmit={submit} className="space-y-5 rounded-3xl border border-border bg-surface p-6">
        <h2 className="text-xl">{t("withdrawTitle")}</h2>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-foreground">{tp("provider")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {PROVIDERS.map((p) => (
              <label key={p} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors", provider === p ? "border-brand-blue bg-brand-sky/40 dark:bg-surface-hover" : "border-border hover:border-brand-blue/50")}>
                <input type="radio" name="provider" value={p} checked={provider === p} onChange={() => setProvider(p)} className="accent-brand-blue" />
                <span className="text-sm font-semibold text-foreground">{tc(p)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-foreground">
            {tp("phone")}
            <div className="mt-1.5 flex">
              <span className="inline-flex h-12 items-center rounded-l-xl border border-r-0 border-border bg-surface-hover px-3 text-sm text-foreground-secondary">+237</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required minLength={8} placeholder="6XX XXX XXX" className={`${field} rounded-l-none`} />
            </div>
          </label>
          <label className="block text-sm font-medium text-foreground">
            {t("amount")}
            <div className="mt-1.5 flex">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={100} max={balance ?? undefined} step={1} required className={`${field} rounded-r-none`} />
              <button type="button" onClick={() => setAmount(String(Math.floor(balance ?? 0)))} className="inline-flex h-12 items-center rounded-r-xl border border-l-0 border-border bg-surface-hover px-3 text-xs font-semibold text-foreground-secondary hover:text-foreground">
                {t("max")}
              </button>
            </div>
            <span className="mt-1 block text-xs font-normal text-foreground-muted">{t("amountHint")}</span>
          </label>
        </div>
        <button type="submit" disabled={busy || !balance} className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-orange px-6 text-sm font-semibold text-white hover:bg-brand-orange-light disabled:opacity-60">
          {busy && <Loader2 className="size-4 animate-spin" />} {t("submit")}
        </button>
      </form>

      <section>
        <h2 className="mb-3 text-2xl">{t("history")}</h2>
        {history === null ? (
          <div className="h-20 animate-pulse rounded-2xl bg-surface-hover" />
        ) : history.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-foreground-secondary">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {history.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-bold text-xl text-brand-blue dark:text-brand-blue-light">{formatPrice(w.amount, locale)}</p>
                  <p className="text-xs text-foreground-muted">
                    {w.provider && tc.has(w.provider) ? tc(w.provider) : w.provider} · +{w.phoneNumber} · {formatDate(w.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  {w.failureReason && <p className="text-xs text-danger">{w.failureReason}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLES[w.status])}>{t(`status.${w.status}`)}</span>
                  {(w.status === "PENDING" || w.status === "PROCESSING") && (
                    <button type="button" onClick={() => refresh(w.id)} className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-foreground-secondary hover:text-foreground" aria-label={t("refresh")}>
                      <RefreshCw className="size-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
