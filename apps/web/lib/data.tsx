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
import { useToast } from "@/components/toast";
import { refusedText } from "@/lib/engine";
import { t } from "@/lib/i18n";
import { type FailedOp, indexedDbStore, Outbox, type OutboxItem, sendToEngine } from "@/lib/outbox";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

// Server data and the write queue. Reads are cached by TanStack Query and kept in IndexedDB, so
// the app opens instantly with the last data it saw, even offline. Writes go through the outbox.

const DAY = 24 * 60 * 60 * 1000;
/** Bump when a cached query changes shape, so data saved by an older app version is dropped. */
const CACHE_VERSION = "v2";
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
  // Stable for the app's lifetime, so the outbox can keep this one.
  const toast = useToast();
  const [outbox] = useState(
    () =>
      new Outbox(indexedDbStore, sendToEngine, ({ error }) => {
        // Whatever happened to an op, the server's version of the data may have changed.
        void queryClient.invalidateQueries();
        // A refused change is said out loud wherever the user is, not only on its order.
        if (error) toast({ text: refusedText(error), tone: "danger" });
      }),
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
      persistOptions={{ persister, maxAge: 7 * DAY, buster: CACHE_VERSION }}
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

export interface EnqueueOptions {
  /** No "Tersimpan" message, for the first op of a step that sends several. */
  quiet?: boolean;
  /** Earlier ops of the same step, newest first, that Batalkan undoes together with this one. */
  undoAlso?: string[];
}

/**
 * Queue an engine op for the active workspace; resolves with its idempotency key. Shows
 * "Tersimpan" with Batalkan: an op still in the queue is dropped, a sent one is undone by the
 * engine (it records every op as a card event under the op's idempotency key).
 */
export function useEnqueue() {
  const outbox = useOutbox();
  const toast = useToast();
  const { state } = useSession();
  const workspaceId = state.status === "signed_in" ? state.workspace?.id : undefined;

  const enqueue = async (
    op: string,
    input: Record<string, unknown>,
    options: EnqueueOptions = {},
  ): Promise<string> => {
    if (!workspaceId) throw new Error("No active workspace");
    const key = await outbox.enqueue(op, workspaceId, input);
    if (options.quiet) return key;
    const keys = [key, ...(options.undoAlso ?? [])];
    if (op === "undo") toast({ text: t("toast.undone") });
    else
      toast({
        text: t("toast.saved"),
        action: { label: t("toast.undo"), run: () => void undo(keys) },
      });
    return key;
  };

  /** Undoes the ops newest first: drops the ones still queued, asks the engine to reverse the rest. */
  async function undo(keys: string[]) {
    if (!workspaceId) return;
    const sent: string[] = [];
    for (const key of keys) if (!(await outbox.cancel(key))) sent.push(key);
    if (sent.length > 0) await outbox.settle();
    for (const key of sent) {
      const { data } = await supabase()
        .from("card_event")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("idempotency_key", key)
        .maybeSingle();
      if (!data) {
        toast({ text: t("toast.undoFailed"), tone: "danger" });
        return;
      }
      await outbox.enqueue("undo", workspaceId, { eventId: Number(data.id) });
    }
    toast({ text: t("toast.undone") });
  }

  return enqueue;
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
