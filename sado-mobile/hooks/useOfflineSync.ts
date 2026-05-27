/**
 * useOfflineSync — wires the AsyncStorage queue into the React tree.
 *
 * Responsibilities:
 *   1. Hydrate the offline store from disk on mount.
 *   2. Detect connectivity transitions (AppState + a periodic API
 *      health probe) and update the store accordingly.
 *   3. When the device is online and the queue is non-empty, kick off
 *      a flush via `services/assessments.uploadRecording`.
 *
 * We deliberately avoid `@react-native-community/netinfo` — adding a
 * native dependency would break Expo Go for the demo. Polling the
 * `/health` endpoint every 20 seconds is good enough for the
 * recording flow and trivially mockable in tests.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { ApiError, apiClient } from "@/services/api";
import { uploadRecording } from "@/services/assessments";
import {
  flush,
  type FlushResult,
  type OfflineRecordingPayload,
} from "@/services/offline-queue";
import {
  selectDeadCount,
  selectIsOffline,
  selectPendingCount,
  useOfflineStore,
} from "@/stores/offline-store";

const PROBE_INTERVAL_MS = 20_000;
const PROBE_TIMEOUT_MS = 4_000;

export interface UseOfflineSyncResult {
  isOffline: boolean;
  pendingCount: number;
  deadCount: number;
  isFlushing: boolean;
  flushNow: () => Promise<FlushResult | null>;
  probeNow: () => Promise<void>;
}

interface UseOfflineSyncOptions {
  /** Override the upload function — used by tests. */
  upload?: (payload: OfflineRecordingPayload) => Promise<void>;
  /** Override the connectivity probe — used by tests. */
  probe?: () => Promise<boolean>;
  /** Disable the AppState/interval listeners. Tests pass `false`. */
  enabled?: boolean;
}

async function defaultUpload(payload: OfflineRecordingPayload): Promise<void> {
  await uploadRecording({
    assessmentId: payload.assessmentId,
    fileUri: payload.fileUri,
    taskType: payload.taskType,
    contentType: payload.contentType,
    durationSec: payload.durationSec,
    prompt: payload.prompt,
    sizeBytes: payload.sizeBytes ?? null,
    sessionId: payload.sessionId ?? null,
  });
}

async function defaultProbe(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await apiClient.get<{ status: string }>("/health", {
      anonymous: true,
      signal: controller.signal,
    });
    return true;
  } catch (error) {
    // Server-reachable errors (4xx/5xx that came from the API) still
    // mean we're online — the connection works, it's just an HTTP
    // failure. Only treat true network errors as offline.
    if (error instanceof ApiError) return true;
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function useOfflineSync(
  options: UseOfflineSyncOptions = {},
): UseOfflineSyncResult {
  const { upload = defaultUpload, probe = defaultProbe, enabled = true } =
    options;

  const isOffline = useOfflineStore(selectIsOffline);
  const pendingCount = useOfflineStore(selectPendingCount);
  const deadCount = useOfflineStore(selectDeadCount);
  const isFlushing = useOfflineStore((state) => state.isFlushing);
  const setConnectivity = useOfflineStore((state) => state.setConnectivity);
  const setFlushing = useOfflineStore((state) => state.setFlushing);
  const hydrate = useOfflineStore((state) => state.hydrate);
  const refresh = useOfflineStore((state) => state.refresh);
  const markFlushed = useOfflineStore((state) => state.markFlushed);

  const inFlight = useRef<Promise<FlushResult | null> | null>(null);

  const flushNow = useCallback(async (): Promise<FlushResult | null> => {
    if (inFlight.current) return inFlight.current;
    const promise = (async (): Promise<FlushResult | null> => {
      const state = useOfflineStore.getState();
      if (state.pending.length === 0) return null;
      setFlushing(true);
      try {
        const result = await flush(upload);
        await refresh();
        markFlushed();
        return result;
      } finally {
        setFlushing(false);
      }
    })();
    inFlight.current = promise;
    try {
      return await promise;
    } finally {
      inFlight.current = null;
    }
  }, [markFlushed, refresh, setFlushing, upload]);

  const probeNow = useCallback(async (): Promise<void> => {
    const online = await probe();
    setConnectivity(online ? "online" : "offline");
    if (online) {
      await flushNow();
    }
  }, [flushNow, probe, setConnectivity]);

  // Hydrate on mount.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Periodic probe + AppState driven probe.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = async (): Promise<void> => {
      if (cancelled) return;
      await probeNow();
    };
    void tick();
    const interval = setInterval(() => {
      void tick();
    }, PROBE_INTERVAL_MS);
    const sub = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") void tick();
      },
    );
    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
  }, [enabled, probeNow]);

  return useMemo(
    () => ({
      isOffline,
      pendingCount,
      deadCount,
      isFlushing,
      flushNow,
      probeNow,
    }),
    [deadCount, flushNow, isFlushing, isOffline, pendingCount, probeNow],
  );
}
