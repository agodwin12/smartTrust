"use client";

import { Eye, ShieldAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useAdminList } from "@/features/admin/useAdminList";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import type { Conversation } from "@/types";
import { usePreview } from "@/components/chat/ConversationList";
import { AdminHeader, AdminTable, ClientPagination, FilterSelect, SearchField, StatusPill, Toolbar, rowAction, type Column } from "./primitives";

/** Staff inbox of buyer ↔ seller conversations (read-only). Opening one is audited. */
export function AdminMessagesView() {
  const t = useTranslations("admin.messages");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const preview = usePreview();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"flagged" | "">("");
  const list = useAdminList<Conversation>("admin/conversations", { search: q || undefined, flagged: filter === "flagged" ? "true" : undefined });

  const columns: Column<Conversation>[] = [
    {
      key: "conversation",
      header: t("conversation"),
      primary: true,
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">
            {c.buyer.name} <span className="font-normal text-foreground-muted">→</span> {c.store.name}
          </p>
          <p className="truncate text-xs text-foreground-muted">{c.buyer.email}</p>
        </div>
      ),
    },
    {
      key: "last",
      header: t("lastMessage"),
      cell: (c) => (
        <div className="min-w-0 max-w-sm">
          <p className="truncate text-sm text-foreground-secondary">{preview(c.lastMessagePreview)}</p>
          <p className="text-xs text-foreground-muted">{t("messageCount", { count: c.messageCount ?? 0 })}</p>
        </div>
      ),
    },
    {
      key: "flag",
      header: <span className="sr-only">{t("flagged")}</span>,
      cell: (c) => (c.flagged ? <StatusPill tone="warning" label={<span className="inline-flex items-center gap-1"><ShieldAlert className="size-3" aria-hidden /> {t("flagged")}</span>} /> : null),
    },
    { key: "date", header: tc("date"), className: "whitespace-nowrap text-foreground-secondary", cell: (c) => formatDate(c.lastMessageAt, locale, { dateStyle: "medium", timeStyle: "short" }) },
    {
      key: "open",
      header: <span className="sr-only">{tc("actions")}</span>,
      className: "text-right",
      cell: (c) => (
        <Link href={`/admin/messages/${c.id}`} className={rowAction}>
          <Eye className="size-3.5" aria-hidden /> {t("open")}
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader title={t("title")} subtitle={t("subtitle")} />
      <Toolbar>
        <SearchField value={q} onChange={setQ} />
        <FilterSelect<"flagged"> ariaLabel={t("flagged")} value={filter} onChange={setFilter} options={[{ value: "flagged", label: t("flaggedOnly") }]} />
      </Toolbar>
      <AdminTable columns={columns} rows={list.items} rowKey={(c) => c.id} loading={list.loading} error={list.error} empty={tc("none")} footer={<ClientPagination page={list.page} pageSize={list.pageSize} total={list.total} onChange={list.setPage} />} />
    </div>
  );
}
