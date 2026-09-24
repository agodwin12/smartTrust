"use client";

import { Banknote, CheckCircle2, Copy, Loader2, ShieldCheck, ShoppingCart, UserRound, XCircle } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { toCartItem, useCart } from "@/features/cart/CartProvider";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CartItem, CheckoutGroup, PaymentMethod, Product } from "@/types";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/EmptyState";

const PROVIDERS = ["MTN_MOMO_CMR", "ORANGE_CMR"] as const;
type Phase = "form" | "starting" | "waiting" | "success" | "cod-success" | "failed";
const POLL_MS = 3000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

const field = "h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors focus:border-brand-blue";
const label = "mb-1 block text-xs font-semibold text-foreground-secondary";

/**
 * Checkout for members and guests alike: one reference and one payment for every item.
 * Without props it checks out the whole cart; with `product` (+ `quantity`) it is the
 * single-item "Buy now" path and leaves the cart untouched.
 */
export function CartCheckoutFlow({ product, quantity = 1 }: { product?: Product; quantity?: number } = {}) {
  const t = useTranslations("checkout");
  const tc = useTranslations("checkout.cart");
  const locale = useLocale();
  const { user, status, authFetch } = useAuth();
  const cart = useCart();

  const [phase, setPhase] = useState<Phase>("form");
  const [method, setMethod] = useState<PaymentMethod>("MOBILE_MONEY");
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>("MTN_MOMO_CMR");
  const [momoPhone, setMomoPhone] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [guest, setGuest] = useState({ name: "", email: "", phone: "" });
  const [group, setGroup] = useState<CheckoutGroup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearInterval(pollTimer.current), []);

  const isGuest = status !== "authenticated";
  const single = Boolean(product);
  const items = useMemo<CartItem[]>(() => (product ? [{ ...toCartItem(product), quantity }] : cart.items), [product, quantity, cart.items]);
  const hydrated = single || cart.hydrated;
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
  const clearCart = () => {
    if (!single) cart.clear();
  };
  const codBlockedBy = useMemo(() => [...new Set(items.filter((i) => i.acceptsCashOnDelivery === false).map((i) => i.storeName))], [items]);
  const cod = method === "CASH_ON_DELIVERY";
  const byStore = useMemo(() => {
    const map = new Map<string, CartItem[]>();
    for (const item of items) map.set(item.storeName, [...(map.get(item.storeName) ?? []), item]);
    return [...map.entries()];
  }, [items]);

  const trackingUrl = group ? `${typeof window === "undefined" ? "" : window.location.origin}${locale === "en" ? "" : `/${locale}`}/orders/track?id=${group.id}&token=${group.accessToken ?? ""}` : "";

  const poll = (id: string, token?: string | null) => {
    const startedAt = Date.now();
    window.clearInterval(pollTimer.current);
    pollTimer.current = window.setInterval(async () => {
      try {
        const { group: g } = await authFetch<{ group: CheckoutGroup }>(`checkout/${id}`, { params: { token: token ?? undefined } });
        setGroup(g);
        const s = g.payment?.status;
        if (s === "COMPLETED") {
          window.clearInterval(pollTimer.current);
          clearCart();
          setPhase("success");
        } else if (s === "FAILED" || s === "CANCELLED") {
          window.clearInterval(pollTimer.current);
          setError(g.payment?.failureReason ?? null);
          setPhase("failed");
        }
      } catch {
        /* transient */
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        window.clearInterval(pollTimer.current);
        setPhase("failed");
      }
    }, POLL_MS);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPhase("starting");
    try {
      const body = {
        items: items.map((i) => ({ advertisementId: i.id, quantity: i.quantity })),
        paymentMethod: method,
        deliveryAddress: address.trim() || undefined,
        deliveryPhone: (deliveryPhone.trim() || (isGuest ? guest.phone.trim() : "")) || undefined, // the field shows the guest's phone as its default
        guest: isGuest ? { name: guest.name.trim(), phone: guest.phone.trim(), email: guest.email.trim() || undefined } : undefined,
      };
      const { group: created } = await authFetch<{ group: CheckoutGroup }>("checkout", { method: "POST", body });
      setGroup(created);
      if (cod) {
        clearCart();
        setPhase("cod-success");
        return;
      }
      await authFetch(`checkout/${created.id}/pay`, { method: "POST", body: { provider, phoneNumber: (momoPhone || (isGuest ? guest.phone : "")).replace(/\s+/g, ""), token: created.accessToken } });
      setPhase("waiting");
      poll(created.id, created.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("startError"));
      setPhase("form");
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      toast.success(tc("copied"));
    } catch {
      toast.error(tc("copyFailed"));
    }
  };

  if (!hydrated || status === "loading") return <Container className="py-12"><div className="h-64 animate-pulse rounded-2xl bg-surface-hover" /></Container>;

  if (items.length === 0 && phase === "form") {
    return (
      <Container className="py-12">
        <EmptyState icon={ShoppingCart} title={tc("emptyTitle")} description={tc("emptyDescription")} action={{ label: tc("emptyAction"), href: "/products" }} />
      </Container>
    );
  }

  const done = phase === "success" || phase === "cod-success";

  return (
    <Container className="py-8 sm:py-12">
      <h1 className="text-3xl">{single ? t("title") : tc("title")}</h1>
      <p className="mt-1 text-sm text-foreground-secondary">{single ? tc("singleSubtitle") : tc("subtitle")}</p>

      {done && group ? (
        <section className="mt-8 rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <CheckCircle2 className="size-12 text-success" aria-hidden />
          <h2 className="mt-3 text-2xl">{phase === "cod-success" ? tc("codSuccessTitle") : tc("successTitle")}</h2>
          <p className="mt-1 text-sm text-foreground-secondary">{tc("reference", { reference: group.reference, count: group.itemCount, total: formatPrice(group.totalAmount, locale) })}</p>
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
            {group.orders.map((line) => (
              <li key={line.id} className="flex items-center gap-3 p-3 text-sm">
                <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-hover">{line.advertisement.images?.[0] && <Image src={line.advertisement.images[0]} alt="" fill sizes="48px" className="object-cover" />}</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{line.advertisement.title}</span>
                <span className="text-foreground-secondary">× {line.quantity}</span>
                <span className="font-semibold">{formatPrice(line.totalAmount, locale)}</span>
              </li>
            ))}
          </ul>
          {group.isGuest ? (
            <div className="mt-5 rounded-xl border border-brand-orange/40 bg-brand-orange/5 p-4">
              <p className="text-sm font-semibold text-foreground">{tc("guestSave")}</p>
              <p className="mt-1 break-all text-xs text-foreground-secondary">{trackingUrl}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={copyLink} className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white hover:bg-brand-blue-light">
                  <Copy className="size-4" /> {tc("copyLink")}
                </button>
                <Link href={`/orders/track?id=${group.id}&token=${group.accessToken ?? ""}`} className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:border-brand-blue">
                  {tc("trackNow")}
                </Link>
              </div>
              <p className="mt-3 text-xs text-foreground-muted">{tc("guestRegisterHint")}</p>
            </div>
          ) : (
            <Link href={`/account/orders/group/${group.id}`} className="mt-5 inline-flex h-11 items-center rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white hover:bg-brand-blue-light">
              {tc("viewOrder")}
            </Link>
          )}
        </section>
      ) : phase === "waiting" ? (
        <section className="mt-8 rounded-2xl border border-border bg-surface p-8 text-center">
          <Loader2 className="mx-auto size-10 animate-spin text-brand-blue" aria-hidden />
          <h2 className="mt-4 text-xl">{t("waiting.title")}</h2>
          <p className="mt-2 text-sm text-foreground-secondary">{t("phoneHint")}</p>
        </section>
      ) : phase === "failed" ? (
        <section className="mt-8 rounded-2xl border border-danger/40 bg-danger/5 p-8 text-center">
          <XCircle className="mx-auto size-10 text-danger" aria-hidden />
          <h2 className="mt-4 text-xl">{t("failed.title")}</h2>
          {error && <p className="mt-2 text-sm text-foreground-secondary">{error}</p>}
          <button type="button" onClick={() => setPhase("form")} className="mt-5 inline-flex h-11 items-center rounded-xl bg-brand-orange px-5 text-sm font-semibold text-white hover:bg-brand-orange-light">
            {tc("tryAgain")}
          </button>
        </section>
      ) : (
        <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="flex items-center gap-2 text-lg"><UserRound className="size-4 text-brand-blue" aria-hidden /> {tc("yourDetails")}</h2>
              {isGuest ? (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-foreground-secondary">
                    {tc("guestIntro")}{" "}
                    <Link href="/login?next=%2Fcheckout" className="font-semibold text-brand-blue hover:underline">{tc("signInInstead")}</Link>
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={label} htmlFor="guest-name">{tc("name")}</label>
                      <input id="guest-name" required minLength={2} maxLength={80} value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} className={field} autoComplete="name" />
                    </div>
                    <div>
                      <label className={label} htmlFor="guest-phone">{tc("phone")}</label>
                      <input id="guest-phone" required minLength={8} value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} className={field} autoComplete="tel" placeholder="6XX XX XX XX" />
                    </div>
                    <div>
                      <label className={label} htmlFor="guest-email">{tc("emailOptional")}</label>
                      <input id="guest-email" type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} className={field} autoComplete="email" />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-foreground-secondary">
                  {user?.firstName} {user?.lastName} · {user?.email}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-lg">{t("method.title")}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(["MOBILE_MONEY", "CASH_ON_DELIVERY"] as PaymentMethod[]).map((m) => {
                  const disabled = m === "CASH_ON_DELIVERY" && codBlockedBy.length > 0;
                  return (
                    <label key={m} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors", method === m ? "border-brand-blue bg-brand-sky/40 dark:bg-surface-hover" : "border-border", disabled && "cursor-not-allowed opacity-60")}>
                      <input type="radio" name="method" value={m} checked={method === m} disabled={disabled} onChange={() => setMethod(m)} className="mt-1" />
                      <span>
                        <span className="block text-sm font-semibold text-foreground">{t(`method.${m}.title`)}</span>
                        <span className="block text-xs text-foreground-secondary">{disabled ? tc("codBlockedBy", { stores: codBlockedBy.join(", ") }) : t(`method.${m}.description`)}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-lg">{t("delivery.title")}</h2>
              <p className="mt-1 text-xs text-foreground-secondary">{cod ? t("delivery.requiredHint") : t("delivery.optionalHint")}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="address">{t("delivery.address")}</label>
                  <textarea id="address" required={cod} minLength={5} maxLength={500} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} className={cn(field, "h-auto py-3")} />
                </div>
                <div>
                  <label className={label} htmlFor="delivery-phone">{t("delivery.phone")}</label>
                  <input id="delivery-phone" required={cod} minLength={8} value={deliveryPhone || (isGuest ? guest.phone : "")} onChange={(e) => setDeliveryPhone(e.target.value)} className={field} autoComplete="tel" />
                </div>
              </div>
            </section>

            {!cod && (
              <section className="rounded-2xl border border-border bg-surface p-5">
                <h2 className="text-lg">{t("payment")}</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {PROVIDERS.map((p) => (
                    <label key={p} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors", provider === p ? "border-brand-blue bg-brand-sky/40 dark:bg-surface-hover" : "border-border")}>
                      <input type="radio" name="provider" value={p} checked={provider === p} onChange={() => setProvider(p)} />
                      <span className={cn("inline-flex size-9 items-center justify-center rounded-lg text-xs font-bold", p === "MTN_MOMO_CMR" ? "bg-market-mtn text-black" : "bg-market-om text-white")}>{p === "MTN_MOMO_CMR" ? "MTN" : "OM"}</span>
                      <span className="text-sm font-semibold text-foreground">{t(p)}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3">
                  <label className={label} htmlFor="momo-phone">{t("phone")}</label>
                  <input id="momo-phone" required minLength={8} value={momoPhone || (isGuest ? guest.phone : "")} onChange={(e) => setMomoPhone(e.target.value)} placeholder={t("phonePlaceholder")} className={field} autoComplete="tel" />
                  <p className="mt-1 text-xs text-foreground-muted">{t("phoneHint")}</p>
                </div>
              </section>
            )}

            {error && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>}
          </div>

          <aside className="h-fit rounded-2xl border border-border bg-surface p-5 lg:sticky lg:top-24">
            <h2 className="text-lg">{t("summary")}</h2>
            <div className="mt-3 space-y-4">
              {byStore.map(([storeName, items]) => (
                <div key={storeName}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{storeName}</p>
                  <ul className="mt-1 space-y-2">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-center gap-3 text-sm">
                        <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-surface-hover">{item.image && <Image src={item.image} alt="" fill sizes="40px" className="object-cover" />}</span>
                        <span className="min-w-0 flex-1 truncate text-foreground">{item.title}</span>
                        <span className="text-foreground-secondary">× {item.quantity}</span>
                        <span className="font-semibold text-foreground">{formatPrice(Number(item.price) * item.quantity, locale)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <span className="text-sm font-semibold text-foreground">{t("total")}</span>
              <span className="font-script text-2xl text-brand-blue dark:text-brand-blue-light">{formatPrice(subtotal, locale)}</span>
            </div>
            <button type="submit" disabled={phase === "starting"} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-orange text-sm font-semibold text-white hover:bg-brand-orange-light disabled:opacity-60">
              {phase === "starting" ? <Loader2 className="size-4 animate-spin" /> : cod ? <Banknote className="size-4" /> : <ShieldCheck className="size-4" />}
              {phase === "starting" ? t("processing") : cod ? tc("placeOrderAll", { count }) : tc("payAll", { amount: formatPrice(subtotal, locale) })}
            </button>
            <p className="mt-3 flex items-start gap-2 text-xs text-foreground-muted">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-brand-blue" aria-hidden /> {cod ? t("codNote", { amount: formatPrice(subtotal, locale) }) : t("escrowNote")}
            </p>
            {product ? (
              <Link href={`/products/${product.slug}`} className="mt-3 block text-center text-xs font-semibold text-brand-blue hover:underline">{tc("backToProduct")}</Link>
            ) : (
              <Link href="/cart" className="mt-3 block text-center text-xs font-semibold text-brand-blue hover:underline">{tc("editCart")}</Link>
            )}
          </aside>
        </form>
      )}
    </Container>
  );
}
