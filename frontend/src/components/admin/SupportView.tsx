"use client";

import { CheckCircle2, Inbox, Loader2, Mail, Newspaper, RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useAdminList } from "@/features/admin/useAdminList";
import { useAuth } from "@/features/auth/AuthProvider";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ContactMessage, NewsletterSubscriber } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";
import { AdminHeader, AdminTable, Checkbox, ClientPagination, StatusPill, Toolbar, rowAction, type Column } from "./primitives";

type Tab = "messages" | "subscribers";

function Messages() {
  const t = useTranslations("admin.support");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const { authFetch } = useAuth();
  const describeError = useAuthError();
  const [unhandledOnly, setUnhandledOnly] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const list = useAdminList<ContactMessage>("support/messages", { unhandled: unhandledOnly ? "true" : undefined });

  const toggle = async (m: ContactMessage) => {
    setBusyId(m.id);
    try {
      await authFetch(`support/messages/${m.id}/handled`, { method: "PATCH", body: { handled: !m.handledAt } });
      list.reload();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Toolbar>
        <Checkbox label={t("unhandledOnly")} checked={unhandledOnly} onChange={setUnhandledOnly} />
      </Toolbar>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {list.error ? (
          <p className="p-6 text-sm text-danger">{list.error}</p>
        ) : list.items === null ? (
          <div className="space-y-px p-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-hover" />
            ))}
          </div>
        ) : list.items.length === 0 ? (
          <div className="flex flex-col items-center p-10 text-center text-sm text-foreground-muted">
            <Inbox className="mb-2 size-6" /> {tc("none")}
          </div>
        ) : (
          <ul className={cn("divide-y divide-border", list.loading && "opacity-60")}>
            {list.items.map((m) => {
              const isOpen = expanded === m.id;
              return (
                <li key={m.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button type="button" onClick={() => setExpanded(isOpen ? null : m.id)} className="min-w-0 flex-1 text-left">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                        <span className="truncate">{m.subject}</span>
                        {m.handledAt ? <StatusPill tone="success" label={t("handled")} /> : <StatusPill tone="warning" label={t("unhandled")} />}
                        <span className="rounded-md bg-surface-hover px-1.5 py-0.5 text-[10px] uppercase text-foreground-muted">{m.locale}</span>
                      </p>
                      <p className="truncate text-xs text-foreground-muted">
                        {m.name} · {m.email} · {formatDate(m.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                      <p className={cn("mt-2 whitespace-pre-line text-sm text-foreground-secondary", !isOpen && "line-clamp-2")}>{m.message}</p>
                    </button>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`} className={rowAction}>
                        <Mail className="size-3.5" /> {t("reply")}
                      </a>
                      <button type="button" disabled={busyId === m.id} onClick={() => toggle(m)} className={cn(rowAction, !m.handledAt && "border-success/40 text-success hover:border-success")}>
                        {busyId === m.id ? <Loader2 className="size-3.5 animate-spin" /> : m.handledAt ? <RotateCcw className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                        {m.handledAt ? tc("cancel") : t("markHandled")}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {list.items && list.items.length > 0 && (
          <div className="border-t border-border px-4 py-3">
            <ClientPagination page={list.page} pageSize={list.pageSize} total={list.total} onChange={list.setPage} />
          </div>
        )}
      </div>
    </div>
  );
}

function Subscribers() {
  const t = useTranslations("admin.support");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const list = useAdminList<NewsletterSubscriber>("support/subscribers", {}, { pageSize: 50 });
  const columns: Column<NewsletterSubscriber>[] = [
    { key: "email", header: tc("email"), primary: true, cell: (s) => <span className="font-medium text-foreground">{s.email}</span> },
    { key: "locale", header: "Lang", className: "uppercase text-foreground-secondary", cell: (s) => s.locale },
    { key: "date", header: tc("date"), className: "whitespace-nowrap text-foreground-secondary", cell: (s) => t("subscribedOn", { date: formatDate(s.createdAt, locale) }) },
  ];
  return <AdminTable columns={columns} rows={list.items} rowKey={(s) => s.id} loading={list.loading} error={list.error} empty={tc("none")} footer={<ClientPagination page={list.page} pageSize={list.pageSize} total={list.total} onChange={list.setPage} />} />;
}

export function SupportView() {
  const t = useTranslations("admin.support");
  const [tab, setTab] = useState<Tab>("messages");
  const tabs: { key: Tab; label: string; icon: typeof Inbox }[] = [
    { key: "messages", label: t("messages"), icon: Inbox },
    { key: "subscribers", label: t("subscribers"), icon: Newspaper },
  ];
  return (
    <div className="space-y-6">
      <AdminHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="flex gap-2">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors", tab === key ? "border-brand-blue bg-brand-blue text-white" : "border-border bg-surface text-foreground-secondary hover:border-brand-blue hover:text-brand-blue")}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      {tab === "messages" ? <Messages /> : <Subscribers />}
    </div>
  );
}
