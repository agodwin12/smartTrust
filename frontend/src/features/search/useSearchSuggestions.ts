"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type SuggestedProduct = {
  id: string;
  title: string;
  slug: string;
  price: string;
  image: string | null;
  category: { name: string; slug: string } | null;
};
export type SuggestedCategory = { id: string; name: string; slug: string; parent: { name: string } | null };
export type SuggestedStore = { id: string; name: string; slug: string; logoUrl: string | null; location: string | null };
export type Suggestions = { query: string; products: SuggestedProduct[]; categories: SuggestedCategory[]; stores: SuggestedStore[] };

export const MIN_SUGGEST_LENGTH = 2;
const DEBOUNCE_MS = 180;
const CACHE_LIMIT = 60;

const EMPTY: Suggestions = { query: "", products: [], categories: [], stores: [] };

/** Per-tab memo of past answers so backspacing through a word never refetches. */
const memo = new Map<string, Suggestions>();

const normalise = (raw: string) => raw.replace(/\s+/g, " ").trim();

/**
 * Debounced typeahead feed for the header search. Nothing is fetched under two characters or
 * while `enabled` is false; a newer keystroke aborts the request in flight.
 */
export function useSearchSuggestions(query: string, enabled: boolean) {
  const q = normalise(query);
  const active = enabled && q.length >= MIN_SUGGEST_LENGTH;
  const [fetched, setFetched] = useState<{ q: string; result: Suggestions } | null>(null);

  useEffect(() => {
    if (!active || memo.has(q)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await apiFetch<Suggestions>("search/suggest", { params: { q }, signal: controller.signal });
        memo.set(q, result);
        if (memo.size > CACHE_LIMIT) {
          const oldest = memo.keys().next().value;
          if (oldest !== undefined) memo.delete(oldest);
        }
        setFetched({ q, result });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Network hiccup: show "no matches" rather than a spinner that never ends.
        setFetched({ q, result: { ...EMPTY, query: q } });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, active]);

  const result = active ? (memo.get(q) ?? (fetched?.q === q ? fetched.result : null)) : null;

  return { suggestions: result ?? EMPTY, loading: active && result === null, active, query: q };
}
