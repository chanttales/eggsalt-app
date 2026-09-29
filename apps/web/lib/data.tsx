"use client";

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { type FailedOp, indexedDbStore, Outbox, type OutboxItem, sendToEngine } from "@/lib/outbox";
import { useSession } from "@/lib/session";

// Server data and the write queue. Reads are cached by TanStack Query and kept in IndexedDB, so
// the app opens instantly with the last data it saw, even offline. Writes go through the outbox.

const DAY = 24 * 60 * 60 * 1000;
const NONE: readonly never[] = [];
const RETRY_EVERY = 20_000;

const Context = createContext<Outbox | null>(null);

const persister = createAsyncStoragePersister({
  key: "papan.query",
  // Undefined while Next.js prerenders pages at build time, which makes the persister a no-op.
  storage:
    typeof indexedDB === "undefined" ? undefined : { getItem: get, setItem: set, removeItem: del },
});

export function DataProvider({ children }: { children: ReactNode }) {
  const { state } = useSession();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { gcTime: 7 * DAY, staleTime: 30_000, networkMode: "offlineFirst" },
        },
      }),
  );
  const [outbox] = useState(
    () =>
      // Whatever happened to an op, the server's version of the data may have changed.
      new Outbox(indexedDbStore, sendToEngine, () => void queryClient.invalidateQueries()),
  );

  // Send queued ops when the app starts, comes back online or to the front, and every so often.
  useEffect(() => {
    if (state.status !== "signed_in") return;
    const flush = () => void outbox.flush();
    flush();
    const timer = setInterval(() => outbox.pending.length > 0 && flush(), RETRY_EVERY);
    const onVisible = () => document.visibilityState === "visible" && flush();
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [state.status, outbox]);

  // Another account may sign in next on this device: forget the last one's data and queue.
  useEffect(() => {
    if (state.status !== "signed_out") return;
    queryClient.clear();
    void persister.removeClient();
    void outbox.clear();
  }, [state.status, queryClient, outbox]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 7 * DAY, buster: "v1" }}
    >
      <Context.Provider value={outbox}>{children}</Context.Provider>
    </PersistQueryClientProvider>
  );
}

function useOutbox(): Outbox {
  const outbox = useContext(Context);
  if (!outbox) throw new Error("useOutbox must be used inside DataProvider");
  return outbox;
}

/** Queue an engine op for the active workspace; resolves with its idempotency key. */
export function useEnqueue() {
  const outbox = useOutbox();
  const { state } = useSession();
  const workspaceId = state.status === "signed_in" ? state.workspace?.id : undefined;
  return (op: string, input: Record<string, unknown>) => {
    if (!workspaceId) throw new Error("No active workspace");
    return outbox.enqueue(op, workspaceId, input);
  };
}

/** Ops still waiting to be sent, for the "belum terkirim" indicator. */
export function usePendingOps(): readonly OutboxItem[] {
  const outbox = useOutbox();
  return useSyncExternalStore(
    (onChange) => outbox.subscribe(onChange),
    () => outbox.pending,
    () => NONE,
  );
}

/** Ops the engine refused (e.g. someone else moved the card first), to explain and dismiss. */
export function useFailedOps(): {
  failures: readonly FailedOp[];
  dismiss: (id: string) => void;
} {
  const outbox = useOutbox();
  const failures = useSyncExternalStore(
    (onChange) => outbox.subscribe(onChange),
    () => outbox.failures,
    () => NONE,
  );
  return { failures, dismiss: (id) => outbox.dismiss(id) };
}
