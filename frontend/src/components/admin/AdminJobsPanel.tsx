"use client";

import { Loader2, Play, Timer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { isSuperAdmin } from "@/features/admin/roles";
import { useAuth } from "@/features/auth/AuthProvider";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { JobInfo, JobRun } from "@/types";
import { useAuthError } from "@/components/auth/useAuthError";
import { StatusPill, rowAction } from "./primitives";

function summarize(run: JobRun | null): string {
  if (!run) return "";
  if (run.skipped) return run.reason ?? "";
  if (!run.ok) return run.error ?? "";
  return Object.entries(run.summary ?? {})
    .filter(([, v]) => typeof v === "number" || typeof v === "string")
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}

/** Dashboard card: the housekeeping jobs, their last outcome, and a "run now" for super admins. */
export function AdminJobsPanel() {
  const t = useTranslations("admin.jobs");
  const locale = useLocale();
  const { user, authFetch } = useAuth();
  const describeError = useAuthError();
  const [jobs, setJobs] = useState<JobInfo[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    () =>
      authFetch<{ jobs: JobInfo[] }>("admin/jobs")
        .then((r) => setJobs(r.jobs))
        .catch(() => setJobs([])),
    [authFetch]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (name: string) => {
    setBusy(name);
    try {
      const { run: record } = await authFetch<{ run: JobRun }>(`admin/jobs/${name}/run`, { method: "POST", body: {} });
      toast[record.ok ? "success" : "error"](record.ok ? `${t("ran")} ${summarize(record)}` : record.error ?? t("failed"));
      await load();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <Timer className="size-4 text-brand-blue dark:text-brand-blue-light" />
        <h2 className="text-lg">{t("title")}</h2>
      </div>
      <p className="mt-1 text-xs text-foreground-muted">{t("subtitle")}</p>
      {jobs === null ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-hover" />
          ))}
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {jobs.map((job) => {
            const last = job.last;
            const tone = !last ? "muted" : last.skipped ? "muted" : last.ok ? "success" : "danger";
            const label = !last ? t("never") : last.skipped ? t("skipped") : last.ok ? t("ok") : t("failed");
            return (
              <li key={job.name} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                    {t.has(`names.${job.name}`) ? t(`names.${job.name}`) : job.name}
                    <StatusPill tone={tone} label={label} />
                    <span className="text-xs font-normal text-foreground-muted">{t("every", { minutes: Math.round(job.intervalMs / 60000) })}</span>
                  </p>
                  <p className="truncate text-xs text-foreground-muted">
                    {last ? `${t("last")}: ${formatDate(last.finishedAt, locale, { dateStyle: "medium", timeStyle: "short" })}` : job.description}
                    {last && summarize(last) && ` · ${summarize(last)}`}
                  </p>
                </div>
                {isSuperAdmin(user) && (
                  <button type="button" disabled={busy !== null} onClick={() => run(job.name)} className={cn(rowAction, "shrink-0")}>
                    {busy === job.name ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} {t("run")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
