import { get, set } from "idb-keyval";
import { callEngine, EngineRequestError } from "@/lib/engine";

// The outbox: every change goes into a queue in IndexedDB first and is sent to the engine in
// order when there's a connection. Each op carries an idempotency key, so a retry after lost
// signal never posts stock or money twice. An op the engine refuses (for example a 409 because
// someone else moved the card) is dropped and reported, so the app can refresh and say why.

export interface OutboxItem {
  /** Also the op's idempotencyKey. */
  id: string;
  op: string;
  workspaceId: string;
  input: Record<string, unknown>;
  createdAt: number;
  attempts: number;
}

export interface OutboxResult {
  item: OutboxItem;
  result?: unknown;
  error?: EngineRequestError;
}

export interface OutboxStore {
  load(): Promise<OutboxItem[]>;
  save(items: OutboxItem[]): Promise<void>;
}

const KEY = "papan.outbox";

// No IndexedDB while Next.js prerenders pages at build time; the queue starts in the browser.
const hasIndexedDb = () => typeof indexedDB !== "undefined";

export const indexedDbStore: OutboxStore = {
  load: async () => (hasIndexedDb() ? ((await get<OutboxItem[]>(KEY)) ?? []) : []),
  save: async (items) => {
    if (hasIndexedDb()) await set(KEY, items);
  },
};

export interface FailedOp {
  item: OutboxItem;
  error: EngineRequestError;
}

type Send = (item: OutboxItem) => Promise<unknown>;
type Listener = (items: readonly OutboxItem[]) => void;

export class Outbox {
  private items: OutboxItem[] = [];
  /** A new array after every change, so React can tell that something changed. */
  private snapshot: readonly OutboxItem[] = [];
  /** Ops the engine refused since the app opened, newest last, for the app to explain. */
  private failed: readonly FailedOp[] = [];
  private loaded: Promise<void>;
  private flushing = false;
  private listeners = new Set<Listener>();

  constructor(
    private store: OutboxStore,
    private send: Send,
    private onResult: (r: OutboxResult) => void = () => {},
  ) {
    this.loaded = store.load().then((items) => {
      this.items = items;
      this.emit();
    });
  }

  /** Queues an op and tries to send it; returns its idempotency key. */
  async enqueue(op: string, workspaceId: string, input: Record<string, unknown>): Promise<string> {
    await this.loaded;
    const id =
      typeof input.idempotencyKey === "string" ? input.idempotencyKey : crypto.randomUUID();
    this.items.push({
      id,
      op,
      workspaceId,
      input: { ...input, idempotencyKey: id },
      createdAt: Date.now(),
      attempts: 0,
    });
    await this.persist();
    void this.flush();
    return id;
  }

  /** Sends queued ops oldest first. Stops at the first one that should be retried later. */
  async flush(): Promise<void> {
    await this.loaded;
    if (this.flushing) return;
    this.flushing = true;
    try {
      while (this.items.length > 0) {
        const item = this.items[0]!;
        try {
          const result = await this.send(item);
          this.items.shift();
          await this.persist();
          this.onResult({ item, result });
        } catch (err) {
          const error =
            err instanceof EngineRequestError
              ? err
              : new EngineRequestError("network", 0, String(err));
          if (error.retryable) {
            item.attempts += 1;
            await this.persist();
            return;
          }
          this.items.shift();
          this.failed = [...this.failed, { item, error }];
          await this.persist();
          this.onResult({ item, error });
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  /** Forgets everything queued and every failure, e.g. on sign-out. */
  async clear(): Promise<void> {
    await this.loaded;
    this.items = [];
    this.failed = [];
    await this.persist();
  }

  dismiss(id: string): void {
    this.failed = this.failed.filter((f) => f.item.id !== id);
    this.emit();
  }

  get pending(): readonly OutboxItem[] {
    return this.snapshot;
  }

  get failures(): readonly FailedOp[] {
    return this.failed;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async persist() {
    await this.store.save(this.items);
    this.emit();
  }

  private emit() {
    this.snapshot = [...this.items];
    for (const l of this.listeners) l(this.snapshot);
  }
}

export function sendToEngine(item: OutboxItem): Promise<unknown> {
  return callEngine(item.op, item.workspaceId, item.input);
}
