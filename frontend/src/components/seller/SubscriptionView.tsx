"use client";

import { Check, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { apiFetch } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Subscription, SubscriptionPlan } from "@/types";
import { MobileMoneyPayment } from "@/components/seller/MobileMoneyPayment";

export function SubscriptionView() {
  const t = useTranslations("sellerArea.subscription");
  const tp = useTranslations("plans");
  const locale = useLocale();
  const { user, authFetch } = useAuth();
  const searchParams = useSearchParams();
  const [current, setCurrent] = useState<Subscription | null | undefined>(undefined);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selected, setSelected] = useState<SubscriptionPlan | null>(null);

  const load = useCallback(async () => {
    const [sub, planList] = await Promise.all([
      authFetch<{ subscription: Subscription | null }>("subscriptions/me").then((r) => r.subscription).catch(() => null),
      apiFetch<{ plans: SubscriptionPlan[] }>("subscription-plans").then((r) => r.plans).catch(() => []),
    ]);
    setCurrent(sub);
    setPlans([...planList].sort((a, b) => Number(a.price) - Number(b.price)));
    const wanted = searchParams.get("plan");
    if (wanted) setSelected(planList.find((p) => p.id === wanted) ?? null);
  }, [authFetch, searchParams]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void load();
  }, [load]);

  const refreshPending = async () => {
    if (!current) return;
    try {
      const { subscription } = await authFetch<{ subscription: Subscription }>(`subscriptions/${current.id}/refresh`);
      setCurrent(subscription);
    } catch {
      /* keep the old state */
    }
  };

  const isActive = current?.status === "ACTIVE" && current.expiresAt && new Date(current.expiresAt) > new Date();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground-secondary">{t("subtitle")}</p>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-xl">{t("current")}</h2>
        {current === undefined ? (
          <div className="mt-3 h-12 animate-pulse rounded-xl bg-surface-hover" />
        ) : !current ? (
          <p className="mt-2 text-sm text-foreground-secondary">{t("none")}</p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground-secondary">
            <span className="text-base font-semibold text-foreground">{current.plan.name}</span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", isActive ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{t(`status.${current.status}`)}</span>
            {current.startsAt && <span>{t("startsAt", { date: formatDate(current.startsAt, locale) })}</span>}
            {current.expiresAt && <span>{t("expiresAt", { date: formatDate(current.expiresAt, locale) })}</span>}
            <span>{tp("ads", { count: current.plan.adQuota - current.adsUsed })}</span>
            {current.status === "PENDING_PAYMENT" && (
              <button type="button" onClick={refreshPending} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline">
                <RefreshCw className="size-3.5" /> {t("refresh")}
              </button>
            )}
          </div>
        )}
        {current?.status === "PENDING_PAYMENT" && <p className="mt-2 text-xs text-warning">{t("pending")}</p>}
      </section>

      <section>
        <h2 className="mb-4 text-2xl">{t("plans")}</h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <li key={plan.id}>
              <button
                type="button"
                onClick={() => setSelected(plan)}
                className={cn(
                  "flex h-full w-full flex-col rounded-2xl border bg-surface p-5 text-left transition-colors",
                  selected?.id === plan.id ? "border-brand-orange shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand-orange)_18%,transparent)]" : "border-border hover:border-brand-blue/50"
                )}
              >
                <span className="font-sans text-lg font-semibold text-foreground">{plan.name}</span>
                <span className="mt-1 font-bold text-3xl text-brand-blue dark:text-brand-blue-light">{formatPrice(plan.price, locale)}</span>
                <span className="text-xs text-foreground-muted">/ {tp("duration", { days: plan.durationDays })}</span>
                <ul className="mt-3 space-y-1 text-sm text-foreground-secondary">
                  <li className="flex gap-2"><Check className="mt-0.5 size-4 text-success" /> {tp("ads", { count: plan.adQuota })}</li>
                  <li className="flex gap-2"><Check className="mt-0.5 size-4 text-success" /> {plan.heroEligible && plan.heroDurationHours ? tp("hero", { hours: plan.heroDurationHours }) : tp("noHero")}</li>
                </ul>
                <span className={cn("mt-4 inline-flex h-10 items-center justify-center rounded-xl text-sm font-semibold", selected?.id === plan.id ? "bg-brand-orange text-white" : "border border-border text-foreground")}>
                  {t("select")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selected && (
        <section className="rounded-3xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-2xl">{t("checkoutTitle", { plan: selected.name })}</h2>
          <MobileMoneyPayment
            key={selected.id}
            amount={Number(selected.price)}
            defaultPhone={user?.phone}
            successTitle={t("activated")}
            onStart={async (provider, phoneNumber) => {
              const { subscription } = await authFetch<{ subscription: Subscription }>("subscriptions/checkout", {
                method: "POST",
                body: { planId: selected.id, provider, phoneNumber },
              });
              setCurrent(subscription);
              return subscription.id;
            }}
            onPoll={async (id) => {
              const { subscription } = await authFetch<{ subscription: Subscription }>(`subscriptions/${id}/refresh`);
              setCurrent(subscription);
              if (subscription.status === "ACTIVE") return "success";
              if (subscription.status === "CANCELLED" || subscription.payment?.status === "FAILED" || subscription.payment?.status === "CANCELLED") return "failed";
              return "pending";
            }}
            onSuccess={() => {
              toast.success(t("activated"));
              void load();
            }}
          />
        </section>
      )}
    </div>
  );
}
