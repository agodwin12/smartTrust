"use client";

import { Banknote, CheckCircle2, Loader2, MailWarning, ShieldCheck, Smartphone, XCircle } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { useCart } from "@/features/cart/CartProvider";
import { Link, usePathname } from "@/i18n/navigation";
import { ApiRequestError } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Order, PaymentMethod, Product } from "@/types";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Container } from "@/components/layout/Container";

const PROVIDERS = ["MTN_MOMO_CMR", "ORANGE_CMR"] as const;
const POLL_MS = 4000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

type Phase = "form" | "starting" | "waiting" | "success" | "cod-success" | "failed";

const field =
  "h-12 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-foreground-muted focus:border-brand-blue focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand-blue)_18%,transparent)]";

function CheckoutInner({ product }: { product: Product }) {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const { user, authFetch } = useAuth();
  const cart = useCart();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const quantity = Math.min(99, Math.max(1, Number(searchParams.get("qty")) || 1));
  const existingOrderId = searchParams.get("order");
  const total = Number(product.price) * quantity;

  const [phase, setPhase] = useState<Phase>("form");
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>("MTN_MOMO_CMR");
  const [phone, setPhone] = useState(user?.phone?.replace(/^\+?237/, "") ?? "");
  const [orderId, setOrderId] = useState<string | null>(existingOrderId);
  const codAvailable = product.store.acceptsCashOnDelivery !== false;
  const [method, setMethod] = useState<PaymentMethod>("MOBILE_MONEY");
  const [address, setAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState(user?.phone ?? "");
  const cod = method === "CASH_ON_DELIVERY";
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearInterval(pollTimer.current), []);

  const startPolling = (id: string) => {
    const startedAt = Date.now();
    window.clearInterval(pollTimer.current);
    pollTimer.current = window.setInterval(async () => {
      try {
        const { order } = await authFetch<{ order: Order }>(`orders/${id}`);
        if (order.status !== "PENDING_PAYMENT") {
          window.clearInterval(pollTimer.current);
          setPhase(order.status === "CANCELLED" ? "failed" : "success");
          if (order.status !== "CANCELLED") cart.remove(product.id);
          return;
        }
        if (order.payment && (order.payment.status === "FAILED" || order.payment.status === "CANCELLED")) {
          window.clearInterval(pollTimer.current);
          setPhase("failed");
          return;
        }
      } catch {
        /* transient — keep polling until the timeout */
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        window.clearInterval(pollTimer.current);
        setPhase("failed");
      }
    }, POLL_MS);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPhase("starting");
    try {
      const delivery = { ...(address.trim() && { deliveryAddress: address.trim() }), ...(deliveryPhone.trim() && { deliveryPhone: deliveryPhone.trim() }) };
      if (cod) {
        const { order } = await authFetch<{ order: Order }>("orders", { method: "POST", body: { advertisementId: product.id, quantity, paymentMethod: "CASH_ON_DELIVERY", ...delivery } });
        setOrderId(order.id);
        cart.remove(product.id);
        setPhase("cod-success");
        return;
      }
      let id = orderId;
      if (!id) {
        const { order } = await authFetch<{ order: Order }>("orders", { method: "POST", body: { advertisementId: product.id, quantity, paymentMethod: "MOBILE_MONEY", ...delivery } });
        id = order.id;
        setOrderId(id);
      }
      const digits = phone.replace(/\D/g, "");
      const phoneNumber = digits.startsWith("237") ? digits : `237${digits}`;
      await authFetch(`orders/${id}/pay`, { method: "POST", body: { provider, phoneNumber } });
      setPhase("waiting");
      startPolling(id);
    } catch (err) {
      setError(t("startError", { message: err instanceof ApiRequestError ? err.message : "" }));
      setPhase("form");
    }
  };

  if (user && !user.emailVerifiedAt) {
    return (
      <Container className="flex flex-1 items-center justify-center py-16">
        <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 text-center">
          <MailWarning className="mx-auto size-10 text-brand-orange" />
          <h1 className="mt-4 text-2xl">{t("verifyEmail.title")}</h1>
          <p className="mt-2 text-sm text-foreground-secondary">{t("verifyEmail.description")}</p>
          <Link href={`/verify-email?next=${encodeURIComponent(`${pathname}?qty=${quantity}`)}`} className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-blue text-sm font-semibold text-white hover:bg-brand-blue-light">
            {t("verifyEmail.action")}
          </Link>
        </div>
      </Container>
    );
  }

  const steps = [t("steps.order"), cod ? t("steps.confirm") : t("steps.pay"), t("steps.done")];
  const stepIndex = phase === "success" || phase === "cod-success" ? 2 : phase === "form" ? 0 : 1;

  return (
    <Container className="py-8 sm:py-12">
      <ol className="mb-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
        {steps.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-[11px]", i <= stepIndex ? "bg-brand-blue text-white" : "bg-surface-hover text-foreground-muted")}>{i + 1}</span>
            <span className={i <= stepIndex ? "text-foreground" : "text-foreground-muted"}>{label}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border sm:w-10" />}
          </li>
        ))}
      </ol>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-3xl border border-border bg-surface p-5 sm:p-7">
          {phase === "success" ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto size-14 text-success" />
              <h1 className="mt-4 text-3xl">{t("success.title")}</h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-foreground-secondary">{t("success.description")}</p>
              <Link href="/orders/track" className="mt-6 inline-flex h-12 items-center rounded-xl bg-brand-blue px-6 text-sm font-semibold text-white hover:bg-brand-blue-light">
                {t("success.action")}
              </Link>
            </div>
          ) : phase === "cod-success" ? (
            <div className="py-6 text-center">
              <Banknote className="mx-auto size-14 text-success" />
              <h1 className="mt-4 text-3xl">{t("codSuccess.title")}</h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-foreground-secondary">{t("codSuccess.description", { amount: formatPrice(total, locale) })}</p>
              <Link href={orderId ? `/account/orders/${orderId}` : "/account/orders"} className="mt-6 inline-flex h-12 items-center rounded-xl bg-brand-blue px-6 text-sm font-semibold text-white hover:bg-brand-blue-light">
                {t("codSuccess.action")}
              </Link>
            </div>
          ) : phase === "failed" ? (
            <div className="py-6 text-center">
              <XCircle className="mx-auto size-14 text-danger" />
              <h1 className="mt-4 text-3xl">{t("failed.title")}</h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-foreground-secondary">{t("failed.description")}</p>
              <button type="button" onClick={() => setPhase("form")} className="mt-6 inline-flex h-12 items-center rounded-xl bg-brand-orange px-6 text-sm font-semibold text-white hover:bg-brand-orange-light">
                {t("failed.retry")}
              </button>
            </div>
          ) : phase === "waiting" ? (
            <div className="py-6 text-center">
              <span className="relative mx-auto inline-flex size-16 items-center justify-center rounded-full bg-brand-sky/70 text-brand-blue dark:bg-surface-elevated">
                <Smartphone className="size-7" />
                <Loader2 className="absolute -right-1 -top-1 size-6 animate-spin text-brand-orange" />
              </span>
              <h1 className="mt-4 text-3xl">{t("waiting.title")}</h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-foreground-secondary">{t("waiting.description", { phone })}</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <h1 className="text-3xl">{t("method.title")}</h1>
              <fieldset>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["MOBILE_MONEY", "CASH_ON_DELIVERY"] as const).map((m) => {
                    const disabled = m === "CASH_ON_DELIVERY" && !codAvailable;
                    return (
                      <label
                        key={m}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                          method === m ? "border-brand-blue bg-brand-sky/40 dark:bg-surface-hover" : "border-border hover:border-brand-blue/50",
                          disabled && "cursor-not-allowed opacity-60"
                        )}
                      >
                        <input type="radio" name="method" value={m} checked={method === m} disabled={disabled} onChange={() => setMethod(m)} className="mt-1 accent-brand-blue" />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            {m === "MOBILE_MONEY" ? <ShieldCheck className="size-4 text-brand-blue dark:text-brand-blue-light" /> : <Banknote className="size-4 text-success" />}
                            {t(`method.${m}.title`)}
                          </span>
                          <span className="mt-1 block text-xs text-foreground-muted">{disabled ? t("method.unavailable") : t(`method.${m}.description`)}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {!cod && (
                <>
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
                      <span className={cn("inline-flex size-9 items-center justify-center rounded-lg text-xs font-bold text-white", p === "MTN_MOMO_CMR" ? "bg-[#FFCC00] text-black" : "bg-[#FF7900]")}>
                        {p === "MTN_MOMO_CMR" ? "MTN" : "OM"}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{t(p)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="block text-sm font-medium text-foreground">
                {t("phone")}
                <div className="mt-1.5 flex">
                  <span className="inline-flex h-12 items-center rounded-l-xl border border-r-0 border-border bg-surface-hover px-3 text-sm text-foreground-secondary">+237</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required minLength={8} placeholder={t("phonePlaceholder")} className={`${field} rounded-l-none`} />
                </div>
                <span className="mt-1 block text-xs font-normal text-foreground-muted">{t("phoneHint")}</span>
              </label>
                </>
              )}
              <fieldset className="space-y-3">
                <legend className="mb-1 text-sm font-medium text-foreground">{t("delivery.title")}</legend>
                <label className="block text-sm font-medium text-foreground">
                  {t("delivery.address")}
                  <textarea value={address} onChange={(e) => setAddress(e.target.value)} required={cod} minLength={cod ? 5 : undefined} maxLength={500} rows={2} placeholder={t("delivery.addressPlaceholder")} className={`${field} mt-1.5 h-auto py-3`} />
                </label>
                <label className="block text-sm font-medium text-foreground">
                  {t("delivery.phone")}
                  <input value={deliveryPhone} onChange={(e) => setDeliveryPhone(e.target.value)} inputMode="tel" required={cod} minLength={cod ? 8 : undefined} maxLength={30} placeholder="+237 6XX XXX XXX" className={`${field} mt-1.5`} />
                  <span className="mt-1 block text-xs font-normal text-foreground-muted">{t("delivery.phoneHint")}</span>
                </label>
              </fieldset>
              {error && <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>}
              <button type="submit" disabled={phase === "starting"} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-orange text-sm font-semibold text-white hover:bg-brand-orange-light disabled:opacity-60">
                {phase === "starting" ? <Loader2 className="size-4 animate-spin" /> : cod ? <Banknote className="size-4" /> : <ShieldCheck className="size-4" />}
                {phase === "starting" ? t("processing") : cod ? t("placeOrder", { amount: formatPrice(total, locale) }) : t("pay", { amount: formatPrice(total, locale) })}
              </button>
              <p className="text-xs text-foreground-muted">{cod ? t("codNote", { amount: formatPrice(total, locale) }) : t("escrowNote")}</p>
            </form>
          )}
        </section>

        <aside className="h-fit rounded-3xl border border-border bg-surface p-5 lg:sticky lg:top-28">
          <h2 className="font-sans text-sm font-semibold uppercase tracking-wider text-foreground-muted">{t("summary")}</h2>
          <div className="mt-4 flex gap-3">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-surface-hover">
              {product.images?.[0] && <Image src={product.images[0]} alt={product.title} fill sizes="80px" className="object-cover" />}
            </div>
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold text-foreground">{product.title}</p>
              <p className="text-xs text-foreground-muted">{product.store.name}</p>
              <p className="mt-1 text-xs text-foreground-secondary">
                {t("quantity")}: {quantity} × {formatPrice(product.price, locale)}
              </p>
            </div>
          </div>
          <p className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm font-semibold text-foreground">{t("total")}</span>
            <span className="font-script text-3xl text-brand-blue dark:text-brand-blue-light">{formatPrice(total, locale)}</span>
          </p>
        </aside>
      </div>
    </Container>
  );
}

export function CheckoutFlow({ product }: { product: Product }) {
  return (
    <RequireAuth>
      <CheckoutInner product={product} />
    </RequireAuth>
  );
}
