"use client";

import { Banknote, CheckCircle2, Loader2, MapPin, PackageCheck, Search, ShieldCheck, XCircle } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CheckoutGroup, CheckoutLine } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";

const PROVIDERS = ["MTN_MOMO_CMR", "ORANGE_CMR"] as const;
const STATUS_CLASS: Record<string, string> = {
  PENDING_PAYMENT: "bg-warning/15 text-warning",
  CONFIRMED: "bg-brand-sky text-brand-blue dark:text-brand-blue-light",
  PAID: "bg-brand-sky text-brand-blue dark:text-brand-blue-light",
  COMPLETED: "bg-success/15 text-success",
  DISPUTED: "bg-danger/10 text-danger",
  REFUNDED: "bg-surface-hover text-foreground-secondary",
  CANCELLED: "bg-surface-hover text-foreground-muted",
};
const field = "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-brand-blue";

type Mode = "account" | "track";

/**
 * One cart checkout (reference SM-…) with its lines. `account` mode loads by id for the
 * signed-in buyer; `track` mode reads ?id&token from the tracking link, or shows the
 * reference + phone lookup form for guests who lost the link.
 */
export function CheckoutGroupView({ mode, groupId }: { mode: Mode; groupId?: string }) {
  const t = useTranslations("orders.group");
  const to = useTranslations("orders");
  const tc = useTranslations("checkout");
  const locale = useLocale();
  const { authFetch, status } = useAuth();
  const describeError = useAuthError();
  const params = useSearchParams();
  const id = groupId ?? params.get("id") ?? undefined;
  const [token, setToken] = useState<string | null>(params.get("token"));
  const [group, setGroup] = useState<CheckoutGroup | null | undefined>(id ? undefined : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>("MTN_MOMO_CMR");
  const [phone, setPhone] = useState("");
  const pollTimer = useRef<number | undefined>(undefined);

  const load = useCallback(
    (gid: string, tok?: string | null) =>
      authFetch<{ group: CheckoutGroup }>(`checkout/${gid}`, { params: { token: tok ?? undefined } })
        .then((r) => setGroup(r.group))
        .catch(() => setGroup(null)),
    [authFetch]
  );

  useEffect(() => {
    if (id && (mode === "track" || status === "authenticated")) void load(id, token);
    return () => window.clearInterval(pollTimer.current);
  }, [id, token, mode, status, load]);

  const lookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setBusy("lookup");
    try {
      const { group: g } = await authFetch<{ group: CheckoutGroup }>("checkout/lookup", { method: "POST", body: { reference: String(f.get("reference")), phone: String(f.get("phone")) } });
      setToken(g.accessToken ?? null);
      setGroup(g);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  const act = async (line: CheckoutLine, action: "confirm-receipt" | "cancel") => {
    if (!group) return;
    if (action === "cancel" && !window.confirm(to("cancelConfirm"))) return;
    setBusy(line.id);
    try {
      await authFetch(`checkout/${group.id}/orders/${line.id}/${action}`, { method: "POST", body: { token: token ?? undefined } });
      toast.success(action === "cancel" ? to("cancelled") : to("confirmed"));
      await load(group.id, token);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  const payNow = async (event: FormEvent) => {
    event.preventDefault();
    if (!group) return;
    setPaying(true);
    try {
      await authFetch(`checkout/${group.id}/pay`, { method: "POST", body: { provider, phoneNumber: phone.replace(/\s+/g, ""), token: token ?? undefined } });
      toast.success(tc("waiting.title"));
      pollTimer.current = window.setInterval(() => void load(group.id, token), 3000);
      window.setTimeout(() => window.clearInterval(pollTimer.current), 3 * 60 * 1000);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setPaying(false);
    }
  };

  if (!id && mode === "track" && !group) {
    return (
      <form onSubmit={lookup} className="mx-auto max-w-md space-y-4 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-xl">{t("lookupTitle")}</h2>
        <p className="text-sm text-foreground-secondary">{t("lookupHint")}</p>
        <label className="block text-xs font-semibold text-foreground-secondary">
          {t("reference")}
          <input name="reference" required placeholder="SM-XXXXXX" className={cn(field, "mt-1 uppercase")} />
        </label>
        <label className="block text-xs font-semibold text-foreground-secondary">
          {t("phoneUsed")}
          <input name="phone" required minLength={8} className={cn(field, "mt-1")} autoComplete="tel" />
        </label>
        <button type="submit" disabled={busy === "lookup"} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-blue text-sm font-semibold text-white hover:bg-brand-blue-light disabled:opacity-60">
          {busy === "lookup" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} {t("find")}
        </button>
      </form>
    );
  }

  if (group === undefined) return <div className="h-64 animate-pulse rounded-2xl bg-surface-hover" />;
  if (group === null) return <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-foreground-secondary">{t("notFound")}</p>;

  const payment = group.payment;
  const awaitingPayment = group.paymentMethod === "MOBILE_MONEY" && group.orders.some((o) => o.status === "PENDING_PAYMENT");
  const paymentInFlight = payment && ["PENDING", "PROCESSING"].includes(payment.status);
  const canPay = awaitingPayment && !paymentInFlight;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{t("title")}</p>
            <h1 className="text-3xl">{group.reference}</h1>
            <p className="mt-1 text-sm text-foreground-secondary">
              {to("placedOn", { date: formatDate(group.createdAt, locale, { dateStyle: "medium", timeStyle: "short" }) })} · {t("items", { count: group.itemCount })} · {to(`paymentMethod.${group.paymentMethod}`)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-foreground-muted">{t("total")}</p>
            <p className="font-bold text-3xl text-brand-blue dark:text-brand-blue-light">{formatPrice(group.totalAmount, locale)}</p>
            {payment && <p className={cn("mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", payment.status === "COMPLETED" ? "bg-success/15 text-success" : paymentInFlight ? "bg-warning/15 text-warning" : "bg-danger/10 text-danger")}>{t(`payment.${payment.status}`)}</p>}
          </div>
        </div>
        {(group.deliveryAddress || group.deliveryPhone) && (
          <p className="mt-3 flex items-start gap-2 text-sm text-foreground-secondary">
            <MapPin className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden />
            <span>
              {group.deliveryAddress}
              {group.deliveryPhone && ` · ${group.deliveryPhone}`}
            </span>
          </p>
        )}
      </header>

      {canPay && (
        <form onSubmit={payNow} className="rounded-2xl border border-brand-orange/40 bg-brand-orange/5 p-5">
          <h2 className="text-lg">{t("payNow")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <select value={provider} onChange={(e) => setProvider(e.target.value as (typeof PROVIDERS)[number])} className={field}>
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {tc(p)}
                </option>
              ))}
            </select>
            <input required minLength={8} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={tc("phonePlaceholder")} className={field} autoComplete="tel" />
            <button type="submit" disabled={paying} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-orange px-5 text-sm font-semibold text-white hover:bg-brand-orange-light disabled:opacity-60">
              {paying ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} {tc("pay", { amount: formatPrice(group.orders.filter((o) => o.status === "PENDING_PAYMENT").reduce((s, o) => s + Number(o.totalAmount), 0), locale) })}
            </button>
          </div>
        </form>
      )}
      {paymentInFlight && (
        <p className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-sm text-foreground-secondary">
          <Loader2 className="size-4 animate-spin text-brand-blue" aria-hidden /> {tc("waiting")}
        </p>
      )}

      <ul className="space-y-3">
        {group.orders.map((line) => {
          const awaitingBuyer = ["PAID", "CONFIRMED"].includes(line.status) && !!line.sellerConfirmedAt && !line.buyerConfirmedAt;
          const cancellable = line.status === "PENDING_PAYMENT" || (line.status === "CONFIRMED" && !line.sellerConfirmedAt);
          return (
            <li key={line.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-surface-hover">{line.advertisement.images?.[0] && <Image src={line.advertisement.images[0]} alt="" fill sizes="64px" className="object-cover" />}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{line.advertisement.title}</p>
                  <p className="text-xs text-foreground-muted">
                    {line.advertisement.store?.name} · × {line.quantity} · {formatPrice(line.totalAmount, locale)}
                  </p>
                  <p className="mt-1 text-xs text-foreground-secondary">{to(`statusHelp.${line.status}`)}</p>
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_CLASS[line.status] ?? "bg-surface-hover")}>{to(`status.${line.status}`)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {awaitingBuyer && (
                  <button type="button" disabled={busy === line.id} onClick={() => act(line, "confirm-receipt")} className="inline-flex h-10 items-center gap-2 rounded-xl bg-success px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                    {busy === line.id ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />} {to("confirmReceipt")}
                  </button>
                )}
                {cancellable && (
                  <button type="button" disabled={busy === line.id} onClick={() => act(line, "cancel")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:border-danger hover:text-danger disabled:opacity-60">
                    <XCircle className="size-4" /> {to("cancel")}
                  </button>
                )}
                {mode === "account" && (
                  <Link href={`/account/orders/${line.id}`} className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:border-brand-blue hover:text-brand-blue">
                    {to("viewDetails")}
                  </Link>
                )}
                {line.status === "COMPLETED" && <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><CheckCircle2 className="size-4" /> {to("status.COMPLETED")}</span>}
              </div>
            </li>
          );
        })}
      </ul>

      {group.isGuest && (
        <p className="flex items-start gap-2 rounded-2xl border border-border bg-surface p-4 text-xs text-foreground-secondary">
          <Banknote className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden /> {t("guestNote")}{" "}
          <Link href="/register" className="font-semibold text-brand-blue hover:underline">{t("guestRegister")}</Link>
        </p>
      )}
    </div>
  );
}
