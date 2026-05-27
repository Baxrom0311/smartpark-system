/**
 * Offline upload queue — AsyncStorage-backed durable buffer for
 * audio recordings that were captured while the device was offline.
 *
 * Why AsyncStorage and not WatermelonDB?
 *   The PROJECT_BRIEF lists WatermelonDB as the long-term offline
 *   layer, but its native module breaks Expo Go and the hosted
 *   builder cannot run a custom dev client. The replan therefore
 *   downgrades the store to AsyncStorage — the trade-off is
 *   documented in `sado-mobile/README.md`.
 *
 * Queue semantics:
 *   - Enqueued items are persisted as JSON with a stable `id`.
 *   - `flush()` walks the queue oldest-first and invokes the supplied
 *     upload function. Successful uploads are dequeued. Failures
 *     increment a `retries` counter; an item that hits
 *     `MAX_RETRIES` is moved to a dead-letter list and surfaced to
 *     the UI so the user can manually retry or discard.
 *   - All mutations go through `withLock` to keep concurrent calls
 *     (e.g. background sync vs. user-driven upload) consistent.
 *
 * The queue does NOT copy the audio file — it only stores a path on
 * device. Callers must keep the file alive until the queue confirms
 * the upload (or call `removeOrphans` after flush).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { RecordingTaskType } from "@/types";

const QUEUE_KEY = "sado.mobile.offlineQueue.v1";
const DEAD_LETTER_KEY = "sado.mobile.offlineQueue.dead.v1";

export const MAX_RETRIES = 5;

export interface OfflineRecordingPayload {
  assessmentId: string;
  fileUri: string;
  taskType: RecordingTaskType;
  contentType: string;
  durationSec: number;
  prompt: string | null;
  /** Optional UI hint (child name, prompt label) for surfacing in lists. */
  label: string | null;
  /** Total file size in bytes — required for resumable session tracking. */
  sizeBytes?: number | null;
  /**
   * Stable upload-session id for chunked/resumable uploads. Present
   * when the file exceeded `CHUNK_THRESHOLD_BYTES` and a session was
   * registered via `services/chunked-upload`. The flush callback uses
   * it as an `X-Upload-Session` idempotency key.
   */
  sessionId?: string | null;
}

export interface OfflineRecordingItem {
  id: string;
  payload: OfflineRecordingPayload;
  retries: number;
  lastError: string | null;
  enqueuedAt: number;
  lastAttemptAt: number | null;
}

export interface FlushResult {
  attempted: number;
  succeeded: number;
  failed: number;
  deadLettered: number;
}

export type UploadFn = (
  payload: OfflineRecordingPayload,
) => Promise<void>;

type Listener = (items: OfflineRecordingItem[]) => void;

const listeners = new Set<Listener>();
let lock: Promise<unknown> = Promise.resolve();

function uid(): string {
  // 96-bit random id is plenty for a per-device queue. We avoid the
  // `crypto.randomUUID` runtime check so the code stays portable to
  // Hermes builds that lack `globalThis.crypto`.
  const r = (): string =>
    Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, "0");
  return `oq_${Date.now().toString(36)}_${r()}${r()}`;
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = lock;
  let release: () => void = () => {};
  lock = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await prev;
    return await fn();
  } finally {
    release();
  }
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

function notify(items: OfflineRecordingItem[]): void {
  for (const listener of listeners) {
    try {
      listener(items);
    } catch (error) {
      console.warn("[offline-queue] listener threw", error);
    }
  }
}

async function readQueueRaw(): Promise<OfflineRecordingItem[]> {
  return readJson<OfflineRecordingItem[]>(QUEUE_KEY, []);
}

async function readDeadRaw(): Promise<OfflineRecordingItem[]> {
  return readJson<OfflineRecordingItem[]>(DEAD_LETTER_KEY, []);
}

async function writeQueue(items: OfflineRecordingItem[]): Promise<void> {
  await writeJson(QUEUE_KEY, items);
  notify(items);
}

async function writeDead(items: OfflineRecordingItem[]): Promise<void> {
  await writeJson(DEAD_LETTER_KEY, items);
}

/** Subscribe to queue changes. Returns an unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  // Fire immediately so consumers can hydrate state on mount.
  void readQueueRaw().then((items) => listener(items));
  return () => {
    listeners.delete(listener);
  };
}

/** Read a snapshot of pending items. */
export async function listPending(): Promise<OfflineRecordingItem[]> {
  return readQueueRaw();
}

/** Read a snapshot of dead-lettered items (max retries exceeded). */
export async function listDeadLetter(): Promise<OfflineRecordingItem[]> {
  return readDeadRaw();
}

export async function enqueue(
  payload: OfflineRecordingPayload,
): Promise<OfflineRecordingItem> {
  return withLock(async () => {
    const queue = await readQueueRaw();
    const item: OfflineRecordingItem = {
      id: uid(),
      payload,
      retries: 0,
      lastError: null,
      enqueuedAt: Date.now(),
      lastAttemptAt: null,
    };
    queue.push(item);
    await writeQueue(queue);
    return item;
  });
}

export async function remove(id: string): Promise<void> {
  await withLock(async () => {
    const queue = await readQueueRaw();
    const next = queue.filter((entry) => entry.id !== id);
    if (next.length !== queue.length) {
      await writeQueue(next);
    }
  });
}

/**
 * Move a dead-letter entry back into the live queue and reset its
 * retry counter. Useful after the user fixes the underlying issue
 * (e.g. logs back in) and explicitly retries from the UI.
 */
export async function requeueDeadLetter(id: string): Promise<void> {
  await withLock(async () => {
    const dead = await readDeadRaw();
    const target = dead.find((entry) => entry.id === id);
    if (!target) return;
    const remainingDead = dead.filter((entry) => entry.id !== id);
    const queue = await readQueueRaw();
    queue.push({
      ...target,
      retries: 0,
      lastError: null,
      lastAttemptAt: null,
    });
    await writeDead(remainingDead);
    await writeQueue(queue);
  });
}

export async function discardDeadLetter(id: string): Promise<void> {
  await withLock(async () => {
    const dead = await readDeadRaw();
    const next = dead.filter((entry) => entry.id !== id);
    if (next.length !== dead.length) {
      await writeDead(next);
    }
  });
}

export async function clear(): Promise<void> {
  await withLock(async () => {
    await writeQueue([]);
    await writeDead([]);
  });
}

/**
 * Drain the queue. Items are processed oldest-first. The supplied
 * `upload` callback is responsible for the actual network call —
 * keeping it injectable lets tests run without `fetch` and keeps the
 * service reusable from screens that already have an upload helper.
 */
export async function flush(upload: UploadFn): Promise<FlushResult> {
  return withLock(async () => {
    const queue = await readQueueRaw();
    if (queue.length === 0) {
      return { attempted: 0, succeeded: 0, failed: 0, deadLettered: 0 };
    }
    const remaining: OfflineRecordingItem[] = [];
    const dead: OfflineRecordingItem[] = await readDeadRaw();
    let succeeded = 0;
    let failed = 0;
    let deadLettered = 0;

    for (const item of queue) {
      try {
        await upload(item.payload);
        succeeded += 1;
      } catch (error) {
        failed += 1;
        const message =
          error instanceof Error ? error.message : String(error);
        const retries = item.retries + 1;
        const updated: OfflineRecordingItem = {
          ...item,
          retries,
          lastError: message,
          lastAttemptAt: Date.now(),
        };
        if (retries >= MAX_RETRIES) {
          dead.push(updated);
          deadLettered += 1;
        } else {
          remaining.push(updated);
        }
      }
    }

    await writeQueue(remaining);
    if (deadLettered > 0) {
      await writeDead(dead);
    }
    return {
      attempted: queue.length,
      succeeded,
      failed,
      deadLettered,
    };
  });
}

/** Test-only helper to inspect the lock state. */
export const __testing = {
  reset: async (): Promise<void> => {
    await AsyncStorage.removeItem(QUEUE_KEY);
    await AsyncStorage.removeItem(DEAD_LETTER_KEY);
    listeners.clear();
  },
};
