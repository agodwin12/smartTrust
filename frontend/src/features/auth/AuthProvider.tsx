"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { apiFetch, ApiRequestError, type FetchOptions } from "@/lib/api";
import { readKey, subscribeKey, writeKey } from "@/lib/local-store";
import type { User } from "@/types";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

type Session = { user: User; accessToken: string };

export type RegisterInput = { email: string; password: string; firstName: string; lastName: string; phone?: string };

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  /** Adopt a session obtained elsewhere (Google OAuth callback). */
  setSession: (session: Session) => void;
  /** Re-read /users/me (after email verification, profile edits, store creation…). */
  refreshUser: () => Promise<User | null>;
  /** Authenticated request: adds the bearer token, transparently refreshes once on 401. */
  authFetch: <T>(path: string, options?: FetchOptions) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_ERROR_CODES = new Set(["TOKEN_MISSING", "TOKEN_EXPIRED", "TOKEN_INVALID", "UNAUTHENTICATED"]);

// The refresh cookie is httpOnly, so the client keeps a plain hint that a session exists.
// Visitors who never signed in resolve to "anonymous" instantly, with no refresh round-trip.
const SESSION_HINT_KEY = "sm:has-session";
const SERVER_HINT = "server";

/**
 * Session model: the short-lived access token lives only in memory here; the
 * refresh token is an httpOnly cookie owned by the API. On first render we ask
 * the API for a fresh access token (cookie → token) so a reload never logs the
 * visitor out, and every 401 triggers exactly one refresh + retry.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<{ status: Exclude<AuthStatus, "anonymous"> | "anonymous"; user: User | null }>({ status: "loading", user: null });
  const tokenRef = useRef<string | null>(null);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const sessionHint = useSyncExternalStore(
    useCallback((cb: () => void) => subscribeKey(SESSION_HINT_KEY, cb), []),
    () => readKey(SESSION_HINT_KEY),
    () => SERVER_HINT
  );

  const applySession = useCallback((next: Session | null) => {
    tokenRef.current = next?.accessToken ?? null;
    setSessionState({ status: next ? "authenticated" : "anonymous", user: next?.user ?? null });
    writeKey(SESSION_HINT_KEY, next ? "1" : null);
  }, []);

  const refresh = useCallback((): Promise<string | null> => {
    if (!refreshInFlight.current) {
      refreshInFlight.current = apiFetch<{ accessToken: string; user: User }>("auth/refresh", { method: "POST" })
        .then((data) => {
          applySession({ accessToken: data.accessToken, user: data.user });
          return data.accessToken;
        })
        .catch(() => {
          applySession(null);
          return null;
        })
        .finally(() => {
          refreshInFlight.current = null;
        });
    }
    return refreshInFlight.current;
  }, [applySession]);

  // Restore the session once, only when a previous sign-in left a hint behind.
  useEffect(() => {
    if (sessionHint === "1" && !tokenRef.current) void refresh();
  }, [sessionHint, refresh]);

  const status: AuthStatus =
    session.status === "authenticated"
      ? "authenticated"
      : sessionHint === SERVER_HINT
        ? "loading"
        : sessionHint === "1"
          ? session.status
          : "anonymous";

  const authFetch = useCallback(
    async <T,>(path: string, options: FetchOptions = {}): Promise<T> => {
      const attempt = (token: string | null) => apiFetch<T>(path, { ...options, token });
      try {
        return await attempt(tokenRef.current);
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401 && AUTH_ERROR_CODES.has(error.code)) {
          const token = await refresh();
          if (token) return attempt(token);
        }
        throw error;
      }
    },
    [refresh]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiFetch<Session>("auth/login", { method: "POST", body: { email, password } });
      applySession(data);
      return data.user;
    },
    [applySession]
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const data = await apiFetch<Session>("auth/register", { method: "POST", body: input });
      applySession(data);
      return data.user;
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch("auth/logout", { method: "POST", token: tokenRef.current });
    } catch {
      /* the cookie is gone either way */
    }
    applySession(null);
  }, [applySession]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await authFetch<{ user: User }>("users/me");
      setSessionState((prev) => ({ ...prev, user: data.user }));
      return data.user;
    } catch {
      return null;
    }
  }, [authFetch]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user: status === "authenticated" ? session.user : null, login, register, logout, setSession: applySession, refreshUser, authFetch }),
    [status, session.user, login, register, logout, applySession, refreshUser, authFetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
