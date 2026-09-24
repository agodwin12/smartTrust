"use client";

import { CreditCard, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { canOperate } from "@/features/admin/roles";
import { useAuth } from "@/features/auth/AuthProvider";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AdminHeader, Checkbox, Field, StatusPill, adminField, adminPrimary, rowAction } from "./primitives";

type PlanRow = SubscriptionPlan & { _count?: { subscriptions: number } };
type Editing = { mode: "create" } | { mode: "edit"; plan: PlanRow };

const featureLines = (features: SubscriptionPlan["features"]) => (Array.isArray(features) ? features.map(String) : []);

function PlanSheet({ editing, onClose, onSaved }: { editing: Editing | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("admin.plans");
  const tc = useTranslations("admin.common");
  const { authFetch } = useAuth();
  const describeError = useAuthError();
  const plan = editing?.mode === "edit" ? editing.plan : null;
  const [busy, setBusy] = useState(false);
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);
  const [heroEligible, setHeroEligible] = useState(plan?.heroEligible ?? false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const f = new FormData(event.currentTarget);
    const num = (k: string) => Number(f.get(k));
    const body: Record<string, unknown> = {
      name: String(f.get("name") ?? "").trim(),
      durationDays: num("durationDays"),
      adQuota: num("adQuota"),
      price: num("price"),
      isActive,
      heroEligible,
      features: String(f.get("features") ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    };
    if (heroEligible) body.heroDurationHours = Math.max(48, num("heroDurationHours") || 48);
    setBusy(true);
    try {
      if (editing.mode === "create") await authFetch("subscription-plans", { method: "POST", body });
      else await authFetch(`subscription-plans/${editing.plan.id}`, { method: "PATCH", body });
      toast.success(editing.mode === "create" ? t("created") : t("updated"));
      onSaved();
      onClose();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!editing} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{plan ? t("edit") : t("new")}</SheetTitle>
          <SheetDescription>{t("subtitle")}</SheetDescription>
        </SheetHeader>
        {editing && (
          <form key={plan?.id ?? "new"} onSubmit={submit} className="space-y-4 px-4 pb-6">
            <Field label={t("form.name")}>
              <input name="name" required defaultValue={plan?.name ?? ""} className={cn(adminField, "w-full")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("form.durationDays")}>
                <input name="durationDays" type="number" min={1} required defaultValue={plan?.durationDays ?? 30} className={cn(adminField, "w-full")} />
              </Field>
              <Field label={t("form.adQuota")}>
                <input name="adQuota" type="number" min={1} required defaultValue={plan?.adQuota ?? 5} className={cn(adminField, "w-full")} />
              </Field>
              <Field label={t("form.price")}>
                <input name="price" type="number" min={0} step={100} required defaultValue={plan ? Number(plan.price) : 5000} className={cn(adminField, "w-full")} />
              </Field>
            </div>
            <Checkbox label={t("form.isActive")} checked={isActive} onChange={setIsActive} />
            <Checkbox label={t("form.heroEligible")} checked={heroEligible} onChange={setHeroEligible} />
            {heroEligible && (
              <Field label={t("form.heroDurationHours")}>
                <input name="heroDurationHours" type="number" min={48} step={1} defaultValue={plan?.heroDurationHours ?? 72} className={cn(adminField, "w-full")} />
              </Field>
            )}
            <Field label={t("form.features")}>
              <textarea name="features" rows={4} defaultValue={featureLines(plan?.features ?? null).join("\n")} className={cn(adminField, "h-auto w-full py-2")} />
            </Field>
            <button type="submit" disabled={busy} className={cn(adminPrimary, "w-full")}>
              {busy && <Loader2 className="size-4 animate-spin" />} {plan ? tc("save") : tc("create")}
            </button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function PlansView() {
  const t = useTranslations("admin.plans");
  const tc = useTranslations("admin.common");
  const tp = useTranslations("plans");
  const locale = useLocale();
  const { user: me, authFetch } = useAuth();
  const describeError = useAuthError();
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    () =>
      authFetch<{ plans: PlanRow[] }>("subscription-plans/all")
        .then((r) => setPlans(r.plans))
        .catch(() => setPlans([])),
    [authFetch]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (plan: PlanRow) => {
    if (!window.confirm(tc("confirmDelete"))) return;
    setBusyId(plan.id);
    try {
      await authFetch(`subscription-plans/${plan.id}`, { method: "DELETE" });
      toast.success(t("deleted"));
      await load();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusyId(null);
    }
  };

  const editable = canOperate(me);

  return (
    <div className="space-y-6">
      <AdminHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          editable && (
            <button type="button" onClick={() => setEditing({ mode: "create" })} className={adminPrimary}>
              <Plus className="size-4" /> {t("new")}
            </button>
          )
        }
      />
      {plans === null ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-surface-hover" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <EmptyState icon={CreditCard} title={tc("none")} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <li key={plan.id} className={cn("flex flex-col rounded-2xl border border-border bg-surface p-5", !plan.isActive && "opacity-70")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl">{plan.name}</h2>
                  <p className="font-script text-2xl text-brand-blue dark:text-brand-blue-light">{formatPrice(plan.price, locale)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {!plan.isActive && <StatusPill tone="muted" label={t("inactive")} />}
                  {plan.heroEligible && <StatusPill tone="warning" label={tp("hero", { hours: plan.heroDurationHours ?? 48 })} />}
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-foreground-secondary">
                <li>{tp("duration", { days: plan.durationDays })}</li>
                <li>{tp("ads", { count: plan.adQuota })}</li>
                {!plan.heroEligible && <li>{tp("noHero")}</li>}
                {featureLines(plan.features).map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-foreground-muted">
                {plan._count?.subscriptions ?? 0} {t("subscriptions")}
              </p>
              {editable && (
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-4">
                  <button type="button" onClick={() => setEditing({ mode: "edit", plan })} className={rowAction}>
                    <Pencil className="size-3.5" /> {tc("edit")}
                  </button>
                  <button type="button" disabled={busyId === plan.id} onClick={() => remove(plan)} className={cn(rowAction, "border-danger/40 text-danger hover:border-danger")}>
                    {busyId === plan.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} {tc("delete")}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <PlanSheet key={editing?.mode === "edit" ? editing.plan.id : editing ? "new" : "closed"} editing={editing} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
}
