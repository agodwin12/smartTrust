"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/features/auth/AuthProvider";
import { API_URL } from "@/lib/api";
import type { ChatMessage } from "@/types";

type ChatContextValue = {
  /** Live connection to the chat server (null while signed out). */
  connected: boolean;
  /** Unread messages across all conversations (header badge). */
  unread: number;
  refreshUnread: () => void;
  /** Listen to a server event; returns the unsubscribe function. */
  on: <T>(event: ChatEvent, handler: (payload: T) => void) => () => void;
  /** "Typing…" for the other participant (the server rate-limits it). */
  typing: (conversationId: string) => void;
};

export type ChatEvent = "message:new" | "conversation:read" | "typing";
export type NewMessageEvent = { conversationId: string; message: ChatMessage };
export type ReadEvent = { conversationId: string; side: "buyer" | "seller"; at: string };
export type TypingEvent = { conversationId: string; userId: string };

const ChatContext = createContext<ChatContextValue | null>(null);

// Socket.IO lives on the API host (same origin as /api).
const SOCKET_URL = new URL(API_URL).origin;
const RETRYABLE = new Set(["TOKEN_INVALID", "TOKEN_EXPIRED", "TOKEN_MISSING"]);

/**
 * Real-time chat connection, opened only while signed in. The access token goes in the
 * handshake (never a URL) and is fetched again on every reconnection, so an expired token is
 * replaced by a fresh one; signing out closes the socket (the server also drops it).
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const { status, user, authFetch, getToken } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = user?.id;

  const fetchUnread = useCallback(() => {
    authFetch<{ total: number }>("conversations/unread")
      .then((r) => setUnread(r.total))
      .catch(() => {});
  }, [authFetch]);

  // Several events in a row (a burst of messages) → one request.
  const refreshUnread = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(fetchUnread, 250);
  }, [fetchUnread]);

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    let retries = 0;
    let fresh = false;
    const s = io(SOCKET_URL, {
      auth: (cb) => {
        getToken(fresh)
          .then((token) => cb({ token: token ?? "" }))
          .catch(() => cb({ token: "" }));
        fresh = false;
      },
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnectionDelayMax: 10_000,
    });
    s.on("connect", () => {
      retries = 0;
      setConnected(true);
      fetchUnread();
    });
    s.on("disconnect", () => setConnected(false));
    // A refused handshake is not retried by Socket.IO itself: retry with a fresh token, a few times.
    s.on("connect_error", (err) => {
      setConnected(false);
      if (RETRYABLE.has(err.message) && retries < 3) {
        retries += 1;
        fresh = true;
        setTimeout(() => s.connect(), 1000 * retries);
      }
    });
    // Updated whenever the server pushes anything (for a counterpart, from another tab…).
    s.on("message:new", (e: NewMessageEvent) => {
      if (e.message.senderId !== userId) refreshUnread();
    });
    s.on("conversation:read", refreshUnread);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the socket is created by this effect
    setSocket(s);
    const onFocus = () => fetchUnread();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
      setConnected(false);
      setUnread(0);
    };
  }, [status, userId, getToken, fetchUnread, refreshUnread]);

  const on = useCallback(
    <T,>(event: ChatEvent, handler: (payload: T) => void) => {
      if (!socket) return () => {};
      socket.on(event, handler as (payload: unknown) => void);
      return () => {
        socket.off(event, handler as (payload: unknown) => void);
      };
    },
    [socket]
  );

  const typing = useCallback((conversationId: string) => socket?.emit("typing", { conversationId }), [socket]);

  const value = useMemo<ChatContextValue>(() => ({ connected, unread, refreshUnread, on, typing }), [connected, unread, refreshUnread, on, typing]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside <ChatProvider>");
  return ctx;
}
