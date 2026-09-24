"use client";

import { ChevronRight, FolderTree, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { canOperate } from "@/features/admin/roles";
import { useAuth } from "@/features/auth/AuthProvider";
import { getAllCategories } from "@/features/catalog/api";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AdminHeader, Checkbox, Field, adminField, adminPrimary, rowAction } from "./primitives";

type Editing = { mode: "create"; parentId?: string } | { mode: "edit"; category: Category };

function CategorySheet({ editing, roots, onClose, onSaved }: { editing: Editing | null; roots: Category[]; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("admin.categories");
  const tc = useTranslations("admin.common");
  const { authFetch } = useAuth();
  const describeError = useAuthError();
  const [busy, setBusy] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);
  const category = editing?.mode === "edit" ? editing.category : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const body = new FormData();
    body.set("name", String(form.get("name") ?? "").trim());
    const parentId = String(form.get("parentId") ?? "");
    if (editing.mode === "create") {
      if (parentId) body.set("parentId", parentId);
    } else {
      body.set("parentId", parentId); // "" → null on the API (moves back to top level)
      if (removeImage) body.set("removeImage", "true");
    }
    const image = form.get("image");
    if (image instanceof File && image.size > 0) body.set("image", image);
    setBusy(true);
    try {
      if (editing.mode === "create") await authFetch("categories", { method: "POST", body });
      else await authFetch(`categories/${editing.category.id}`, { method: "PATCH", body });
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
          <SheetTitle>{category ? t("edit") : t("new")}</SheetTitle>
          <SheetDescription>{t("subtitle")}</SheetDescription>
        </SheetHeader>
        {editing && (
          <form key={category?.id ?? "new"} onSubmit={submit} className="space-y-4 px-4 pb-6">
            <Field label={t("name")}>
              <input name="name" required defaultValue={category?.name ?? ""} className={cn(adminField, "w-full")} />
            </Field>
            <Field label={t("parent")}>
              <select name="parentId" defaultValue={category?.parentId ?? (editing.mode === "create" ? editing.parentId ?? "" : "")} className={cn(adminField, "w-full")}>
                <option value="">{t("noParent")}</option>
                {roots
                  .filter((r) => r.id !== category?.id)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={t("image")} hint={category?.imageUrl ? t("keepImage") : undefined}>
              <input name="image" type="file" accept="image/*" className={cn(adminField, "w-full py-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-brand-blue/10 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-brand-blue")} />
            </Field>
            {category?.imageUrl && (
              <div className="flex items-center gap-3">
                <span className="relative size-14 overflow-hidden rounded-xl bg-surface-hover">
                  <Image src={category.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                </span>
                <Checkbox label={t("removeImage")} checked={removeImage} onChange={setRemoveImage} />
              </div>
            )}
            <button type="submit" disabled={busy} className={cn(adminPrimary, "w-full")}>
              {busy && <Loader2 className="size-4 animate-spin" />} {category ? tc("save") : tc("create")}
            </button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function CategoriesView() {
  const t = useTranslations("admin.categories");
  const tc = useTranslations("admin.common");
  const { user: me, authFetch } = useAuth();
  const describeError = useAuthError();
  const [roots, setRoots] = useState<Category[] | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // The list endpoint is flat (roots and sub-categories as separate rows) — assemble the tree here.
  const load = useCallback(
    () =>
      getAllCategories()
        .then((all) =>
          setRoots(
            all
              .filter((c) => !c.parentId)
              .map((root) => ({ ...root, children: all.filter((c) => c.parentId === root.id).sort((a, b) => a.name.localeCompare(b.name)) }))
              .sort((a, b) => a.name.localeCompare(b.name))
          )
        )
        .catch(() => setRoots([])),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (category: Category) => {
    if (!window.confirm(tc("confirmDelete"))) return;
    setBusyId(category.id);
    try {
      await authFetch(`categories/${category.id}`, { method: "DELETE" });
      toast.success(t("deleted"));
      await load();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusyId(null);
    }
  };

  const editable = canOperate(me);

  const Row = ({ category, depth }: { category: Category; depth: number }) => (
    <li className={cn("flex flex-wrap items-center gap-3 py-3", depth > 0 && "pl-6 sm:pl-14")}>
      {depth > 0 && <ChevronRight className="size-3.5 shrink-0 text-foreground-muted" />}
      <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-surface-hover">
        {category.imageUrl && <Image src={category.imageUrl} alt="" fill sizes="44px" className="object-cover" />}
      </span>
      <div className="min-w-0 flex-1">
        <Link href={`/categories/${category.slug}`} className="block truncate font-semibold text-foreground hover:text-brand-blue">
          {category.name}
        </Link>
        <p className="text-xs text-foreground-muted">
          {depth === 0 && `${t("children", { count: category.children?.length ?? 0 })} · `}
          {t("products", { count: category.productCount ?? 0 })}
        </p>
      </div>
      {editable && (
        <div className="flex flex-wrap gap-1.5">
          {depth === 0 && (
            <button type="button" onClick={() => setEditing({ mode: "create", parentId: category.id })} className={rowAction}>
              <Plus className="size-3.5" /> {t("new")}
            </button>
          )}
          <button type="button" onClick={() => setEditing({ mode: "edit", category })} className={rowAction}>
            <Pencil className="size-3.5" /> {tc("edit")}
          </button>
          <button type="button" disabled={busyId === category.id} onClick={() => remove(category)} className={cn(rowAction, "border-danger/40 text-danger hover:border-danger")}>
            {busyId === category.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} {tc("delete")}
          </button>
        </div>
      )}
    </li>
  );

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
      {roots === null ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-hover" />
          ))}
        </div>
      ) : roots.length === 0 ? (
        <EmptyState icon={FolderTree} title={tc("none")} />
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface px-4">
          {roots.map((root) => (
            <li key={root.id}>
              <ul className="divide-y divide-border/60">
                <Row category={root} depth={0} />
                {root.children?.map((child) => <Row key={child.id} category={child} depth={1} />)}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <CategorySheet editing={editing} roots={roots ?? []} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
}
