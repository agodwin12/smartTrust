"use client";

import { Ban, Loader2, Pencil, Plus, Rocket, Zap } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAdminList } from "@/features/admin/useAdminList";
import { canOperate } from "@/features/admin/roles";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FlashCampaign, FlashCampaignPhase, FlashCampaignStatus } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AdminHeader, AdminTable, Checkbox, ClientPagination, Field, FilterSelect, StatusPill, Toolbar, adminField, adminPrimary, rowAction, type Column } from "./primitives";

export const PHASE_TONE: Record<FlashCampaignPhase, "info" | "success" | "warning" | "muted"> = {
  DRAFT: "muted",
  PUBLISHED: "info",
  SCHEDULED: "info",
  ACTIVE: "success",
  ENDED: "muted",
  CANCELLED: "warning",
};

const STATUSES: FlashCampaignStatus[] = ["DRAFT", "PUBLISHED", "CANCELLED"];

/** ISO → value for <input type="datetime-local"> in the browser's zone. */
export const toLocalInput = (iso?: string | null) => {
  const d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

type Editing = { mode: "create" } | { mode: "edit"; campaign: FlashCampaign };

export function CampaignSheet({ editing, onClose, onSaved }: { editing: Editing | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("admin.flash");
  const tc = useTranslations("admin.common");
  const { authFetch } = useAuth();
  const describeError = useAuthError();
  const campaign = editing?.mode === "edit" ? editing.campaign : null;
  const [busy, setBusy] = useState(false);
  const [applicationsOpen, setApplicationsOpen] = useState(campaign?.applicationsOpen ?? true);
  // Default dates are computed once per opened form (the sheet is keyed by campaign), never during a re-render.
  const [defaults] = useState(() => ({
    startsAt: toLocalInput(campaign?.startsAt),
    endsAt: toLocalInput(campaign?.endsAt ?? new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString()),
  }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const f = new FormData(event.currentTarget);
    const body = {
      name: String(f.get("name") ?? "").trim(),
      description: String(f.get("description") ?? "").trim() || (campaign ? null : undefined),
      startsAt: new Date(String(f.get("startsAt"))).toISOString(),
      endsAt: new Date(String(f.get("endsAt"))).toISOString(),
      minDiscountPercent: Number(f.get("minDiscountPercent")) || 10,
      applicationsOpen,
    };
    setBusy(true);
    try {
      if (editing.mode === "create") await authFetch("flash-campaigns", { method: "POST", body });
      else await authFetch(`flash-campaigns/${editing.campaign.id}`, { method: "PATCH", body });
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
          <SheetTitle>{campaign ? t("edit") : t("new")}</SheetTitle>
          <SheetDescription>{t("subtitle")}</SheetDescription>
        </SheetHeader>
        {editing && (
          <form key={campaign?.id ?? "new"} onSubmit={submit} className="space-y-4 px-4 pb-6">
            <Field label={t("form.name")}>
              <input name="name" required minLength={3} maxLength={80} defaultValue={campaign?.name ?? ""} className={cn(adminField, "w-full")} />
            </Field>
            <Field label={t("form.description")}>
              <textarea name="description" rows={3} maxLength={1000} defaultValue={campaign?.description ?? ""} className={cn(adminField, "h-auto w-full py-2")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("form.startsAt")}>
                <input name="startsAt" type="datetime-local" required defaultValue={defaults.startsAt} className={cn(adminField, "w-full")} />
              </Field>
              <Field label={t("form.endsAt")}>
                <input name="endsAt" type="datetime-local" required defaultValue={defaults.endsAt} className={cn(adminField, "w-full")} />
              </Field>
            </div>
            <Field label={t("form.minDiscountPercent")}>
              <input name="minDiscountPercent" type="number" min={1} max={90} required defaultValue={campaign?.minDiscountPercent ?? 10} className={cn(adminField, "w-full")} />
            </Field>
            <Checkbox label={t("form.applicationsOpen")} checked={applicationsOpen} onChange={setApplicationsOpen} />
            <button type="submit" disabled={busy} className={cn(adminPrimary, "w-full")}>
              {busy && <Loader2 className="size-4 animate-spin" />} {campaign ? tc("save") : tc("create")}
            </button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function FlashCampaignsView() {
  const t = useTranslations("admin.flash");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const { user: me, authFetch } = useAuth();
  const describeError = useAuthError();
  const [status, setStatus] = useState<FlashCampaignStatus | "">("");
  const list = useAdminList<FlashCampaign>("flash-campaigns/admin", { status: status || undefined });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const editable = canOperate(me);

  const act = async (campaign: FlashCampaign, action: "publish" | "cancel") => {
    if (action === "cancel" && !window.confirm(t("confirmCancel"))) return;
    setBusyId(campaign.id);
    try {
      await authFetch(`flash-campaigns/${campaign.id}/${action}`, { method: "POST" });
      toast.success(action === "publish" ? t("published") : t("cancelled"));
      list.reload();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusyId(null);
    }
  };

  const when = (iso: string) => formatDate(iso, locale, { dateStyle: "medium", timeStyle: "short" });

  const columns: Column<FlashCampaign>[] = [
    {
      key: "name",
      header: t("columns.campaign"),
      primary: true,
      cell: (c) => (
        <div className="min-w-0">
          <Link href={`/admin/flash-deals/${c.id}`} className="block truncate font-semibold text-foreground hover:text-brand-blue">
            {c.name}
          </Link>
          <p className="truncate text-xs text-foreground-muted">{c.description ?? "—"}</p>
        </div>
      ),
    },
    { key: "phase", header: tc("status"), cell: (c) => <StatusPill tone={PHASE_TONE[c.phase]} label={t(`phase.${c.phase}`)} /> },
    { key: "dates", header: t("columns.dates"), className: "whitespace-nowrap text-foreground-secondary", cell: (c) => `${when(c.startsAt)} → ${when(c.endsAt)}` },
    {
      key: "items",
      header: t("columns.items"),
      cell: (c) => (
        <span>
          {c.itemCount ?? 0}
          {(c.pendingCount ?? 0) > 0 && <span className="ml-1.5 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">{t("pending", { count: c.pendingCount ?? 0 })}</span>}
        </span>
      ),
    },
    { key: "discount", header: t("columns.discount"), cell: (c) => `≥ ${c.minDiscountPercent}%` },
    {
      key: "actions",
      header: <span className="sr-only">{tc("actions")}</span>,
      className: "text-right",
      cell: (c) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          <Link href={`/admin/flash-deals/${c.id}`} className={rowAction}>
            {tc("view")}
          </Link>
          {editable && c.status !== "CANCELLED" && (
            <button type="button" onClick={() => setEditing({ mode: "edit", campaign: c })} className={rowAction}>
              <Pencil className="size-3.5" /> {tc("edit")}
            </button>
          )}
          {editable && c.status === "DRAFT" && (
            <button type="button" disabled={busyId === c.id} onClick={() => act(c, "publish")} className={cn(rowAction, "border-success/40 text-success hover:border-success")}>
              {busyId === c.id ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />} {t("publish")}
            </button>
          )}
          {editable && c.status === "PUBLISHED" && c.phase !== "ENDED" && (
            <button type="button" disabled={busyId === c.id} onClick={() => act(c, "cancel")} className={cn(rowAction, "border-danger/40 text-danger hover:border-danger")}>
              {busyId === c.id ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />} {t("cancel")}
            </button>
          )}
        </div>
      ),
    },
  ];

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
      <Toolbar>
        <FilterSelect<FlashCampaignStatus> ariaLabel={tc("status")} value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: t(`phase.${s}`) }))} />
      </Toolbar>
      <AdminTable
        columns={columns}
        rows={list.items}
        rowKey={(c) => c.id}
        loading={list.loading}
        error={list.error}
        empty={t("empty")}
        footer={<ClientPagination page={list.page} pageSize={list.pageSize} total={list.total} onChange={list.setPage} />}
      />
      <CampaignSheet key={editing?.mode === "edit" ? editing.campaign.id : editing ? "new" : "closed"} editing={editing} onClose={() => setEditing(null)} onSaved={list.reload} />
      <p className="flex items-center gap-2 text-xs text-foreground-muted">
        <Zap className="size-3.5" aria-hidden /> {t("hint")}
      </p>
    </div>
  );
}
