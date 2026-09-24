"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import type { QueryParams } from "@/lib/api";
import type { Paginated } from "@/types";

type Options = { pageSize?: number };

/**
 * Paginated staff list: refetches when the filters change (page resets to 1 without an
 * extra render), exposes `reload()` for after a mutation. Errors surface as a message
 * so views can render them instead of an endless skeleton.
 */
export function useAdminList<T>(path: string, params: QueryParams = {}, { pageSize = 20 }: Options = {}) {
  const { authFetch } = useAuth();
  const filterKey = JSON.stringify(params);
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const [version, setVersion] = useState(0);
  const [data, setData] = useState<Paginated<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start of a fetch keyed on filters/page
    setLoading(true);
    authFetch<Paginated<T>>(path, { params: { ...JSON.parse(filterKey), page, pageSize } })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [authFetch, path, filterKey, page, pageSize, version]);

  const setPage = useCallback((next: number) => setPageState({ key: filterKey, page: next }), [filterKey]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { data, items: data?.items ?? null, total: data?.total ?? 0, page, pageSize, setPage, reload, loading, error };
}
