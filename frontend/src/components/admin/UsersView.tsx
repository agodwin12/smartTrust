"use client";

import { BadgeCheck, Loader2, ShieldOff, UserCheck, UserPlus, UserX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { canOperate, isSuperAdmin } from "@/features/admin/roles";
import { useAdminList } from "@/features/admin/useAdminList";
import { useAuth } from "@/features/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { User, UserRole } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AdminHeader, AdminTable, ClientPagination, Field, FilterSelect, SearchField, StatusPill, Toolbar, adminField, adminPrimary, rowAction, type Column } from "./primitives";

const ROLES: UserRole[] = ["CUSTOMER", "CUSTOMER_SERVICE", "ACCOUNTANT", "SUPER_ADMIN"];
const STAFF_ONLY: UserRole[] = ["CUSTOMER_SERVICE", "ACCOUNTANT", "SUPER_ADMIN"];
const STATUSES: User["status"][] = ["ACTIVE", "SUSPENDED", "BANNED"];

type UserRow = User & { store?: { id: string; name: string; slug: string } | null };

function CreateStaffSheet({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const t = useTranslations("admin.users");
  const { authFetch } = useAuth();
  const describeError = useAuthError();
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    setBusy(true);
    try {
      await authFetch("users/staff", { method: "POST", body: { ...data, phone: data.phone || undefined } });
      toast.success(t("staffCreated"));
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("createStaff")}</SheetTitle>
          <SheetDescription>{t("subtitle")}</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="space-y-4 px-4 pb-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.firstName")}>
              <input name="firstName" required className={cn(adminField, "w-full")} />
            </Field>
            <Field label={t("form.lastName")}>
              <input name="lastName" required className={cn(adminField, "w-full")} />
            </Field>
          </div>
          <Field label={t("form.email")}>
            <input name="email" type="email" required autoComplete="off" className={cn(adminField, "w-full")} />
          </Field>
          <Field label={t("form.phone")}>
            <input name="phone" type="tel" className={cn(adminField, "w-full")} />
          </Field>
          <Field label={t("form.password")}>
            <input name="password" type="text" required minLength={8} autoComplete="new-password" className={cn(adminField, "w-full")} />
          </Field>
          <Field label={t("form.role")}>
            <select name="role" defaultValue="CUSTOMER_SERVICE" className={cn(adminField, "w-full")}>
              {STAFF_ONLY.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" disabled={busy} className={cn(adminPrimary, "w-full")}>
            {busy && <Loader2 className="size-4 animate-spin" />} {t("form.submit")}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function UsersView() {
  const t = useTranslations("admin.users");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const { user: me, authFetch } = useAuth();
  const describeError = useAuthError();
  const search = useSearchParams();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<UserRole | "staff" | "">(search.get("role") === "staff" ? "staff" : "");
  const [status, setStatus] = useState<User["status"] | "">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // "staff" is a UI shortcut: the API filters one role at a time, so we drop the filter and hide customers client-side.
  const list = useAdminList<UserRow>("users", { search: q || undefined, role: role && role !== "staff" ? role : undefined, status: status || undefined }, { pageSize: role === "staff" ? 100 : 20 });
  const rows = list.items ? (role === "staff" ? list.items.filter((u) => u.role !== "CUSTOMER") : list.items) : null;

  const mutate = async (id: string, path: string, body: unknown, success: string) => {
    setBusyId(id);
    try {
      await authFetch(path, { method: "PATCH", body });
      toast.success(success);
      list.reload();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusyId(null);
    }
  };

  const columns: Column<UserRow>[] = [
    {
      key: "name",
      header: tc("name"),
      primary: true,
      cell: (u) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-semibold text-foreground">
            {u.firstName} {u.lastName}
            {u.emailVerifiedAt && <BadgeCheck className="size-3.5 shrink-0 text-brand-blue" aria-label={t("verified")} />}
            {u.id === me?.id && <span className="text-[10px] font-normal text-foreground-muted">({t("you")})</span>}
          </p>
          <p className="truncate text-xs text-foreground-muted">{u.email}</p>
        </div>
      ),
    },
    { key: "role", header: tc("role"), cell: (u) => <StatusPill tone={u.role === "CUSTOMER" ? "muted" : "info"} label={t(`roles.${u.role}`)} /> },
    { key: "status", header: tc("status"), cell: (u) => <StatusPill status={u.status} label={t(`statuses.${u.status}`)} /> },
    {
      key: "store",
      header: tc("store"),
      cell: (u) =>
        u.store ? (
          <Link href={`/stores/${u.store.slug}`} className="text-brand-blue hover:underline">
            {u.store.name}
          </Link>
        ) : (
          <span className="text-foreground-muted">—</span>
        ),
    },
    { key: "joined", header: tc("date"), className: "whitespace-nowrap text-foreground-secondary", cell: (u) => formatDate(u.createdAt, locale) },
    {
      key: "actions",
      header: <span className="sr-only">{tc("actions")}</span>,
      className: "text-right",
      cell: (u) => {
        const busy = busyId === u.id;
        const self = u.id === me?.id;
        if (!canOperate(me) || self) return null;
        return (
          <div className="flex flex-wrap justify-end gap-1.5">
            {u.status !== "ACTIVE" ? (
              <button type="button" disabled={busy} onClick={() => mutate(u.id, `users/${u.id}/status`, { status: "ACTIVE" }, t("statusUpdated"))} className={cn(rowAction, "border-success/40 text-success hover:border-success")}>
                <UserCheck className="size-3.5" /> {t("reactivate")}
              </button>
            ) : (
              <>
                <button type="button" disabled={busy} onClick={() => mutate(u.id, `users/${u.id}/status`, { status: "SUSPENDED" }, t("statusUpdated"))} className={rowAction}>
                  <ShieldOff className="size-3.5" /> {t("suspend")}
                </button>
                <button type="button" disabled={busy} onClick={() => mutate(u.id, `users/${u.id}/status`, { status: "BANNED" }, t("statusUpdated"))} className={cn(rowAction, "border-danger/40 text-danger hover:border-danger")}>
                  <UserX className="size-3.5" /> {t("ban")}
                </button>
              </>
            )}
            {isSuperAdmin(me) && (
              <select aria-label={t("changeRole")} value={u.role} disabled={busy} onChange={(e) => mutate(u.id, `users/${u.id}/role`, { role: e.target.value }, t("roleUpdated"))} className={cn(adminField, "h-8 px-2 text-xs")}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          isSuperAdmin(me) && (
            <button type="button" onClick={() => setCreateOpen(true)} className={adminPrimary}>
              <UserPlus className="size-4" /> {t("createStaff")}
            </button>
          )
        }
      />
      <Toolbar>
        <SearchField value={q} onChange={setQ} />
        <FilterSelect<UserRole | "staff"> ariaLabel={tc("role")} value={role} onChange={setRole} options={[{ value: "staff", label: t("staffFilter") }, ...ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))]} />
        <FilterSelect<User["status"]> ariaLabel={tc("status")} value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) }))} />
      </Toolbar>
      <AdminTable columns={columns} rows={rows} rowKey={(u) => u.id} loading={list.loading} error={list.error} empty={tc("none")} footer={<ClientPagination page={list.page} pageSize={list.pageSize} total={list.total} onChange={list.setPage} />} />
      {isSuperAdmin(me) && <CreateStaffSheet open={createOpen} onOpenChange={setCreateOpen} onCreated={list.reload} />}
    </div>
  );
}
