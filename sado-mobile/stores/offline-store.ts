/**
 * Zustand store exposing the offline queue state to the UI.
 *
 * The store is intentionally thin — the source of truth lives in
 * AsyncStorage via `services/offline-queue`. The store mirrors the
 * persisted state for synchronous reads (e.g. header badges) and
 * tracks the live online status reported by the network detector.
 */

import { create } from "zustand";

import {
  type OfflineRecordingItem,
  listDeadLetter,
  listPending,
  subscribe,
} from "@/services/offline-queue";

export type ConnectivityStatus = "online" | "offline" | "unknown";

interface OfflineState {
  pending: OfflineRecordingItem[];
  dead: OfflineRecordingItem[];
  connectivity: ConnectivityStatus;
  /** Last successful flush timestamp (epoch ms) for telemetry. */
  lastFlushAt: number | null;
  /** Whether a flush is currently in progress. */
  isFlushing: boolean;
  setConnectivity: (status: ConnectivityStatus) => void;
  setFlushing: (flushing: boolean) => void;
  refresh: () => Promise<void>;
  hydrate: () => Promise<void>;
  __setPending: (items: OfflineRecordingItem[]) => void;
  __setDead: (items: OfflineRecordingItem[]) => void;
  markFlushed: () => void;
}

let unsubscribe: (() => void) | null = null;

export const useOfflineStore = create<OfflineState>((set, get) => ({
  pending: [],
  dead: [],
  connectivity: "unknown",
  lastFlushAt: null,
  isFlushing: false,
  setConnectivity: (status) => set({ connectivity: status }),
  setFlushing: (flushing) => set({ isFlushing: flushing }),
  __setPending: (items) => set({ pending: items }),
  __setDead: (items) => set({ dead: items }),
  markFlushed: () => set({ lastFlushAt: Date.now(), isFlushing: false }),
  refresh: async () => {
    const [pending, dead] = await Promise.all([
      listPending(),
      listDeadLetter(),
    ]);
    set({ pending, dead });
  },
  hydrate: async () => {
    if (!unsubscribe) {
      unsubscribe = subscribe((items) => {
        set({ pending: items });
      });
    }
    await get().refresh();
  },
}));

/**
 * Selector helpers — keeping selectors as standalone functions makes
 * them easy to memoize and reuse from header badges and progress
 * screens without re-reading the whole store object.
 */
export const selectPendingCount = (state: OfflineState): number =>
  state.pending.length;
export const selectDeadCount = (state: OfflineState): number =>
  state.dead.length;
export const selectIsOffline = (state: OfflineState): boolean =>
  state.connectivity === "offline";
export const selectIsOnline = (state: OfflineState): boolean =>
  state.connectivity === "online";

export function __resetOfflineStoreForTests(): void {
  unsubscribe?.();
  unsubscribe = null;
  useOfflineStore.setState({
    pending: [],
    dead: [],
    connectivity: "unknown",
    lastFlushAt: null,
    isFlushing: false,
  });
}
