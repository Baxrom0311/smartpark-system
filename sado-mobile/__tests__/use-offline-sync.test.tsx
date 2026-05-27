/**
 * Hook tests for `useOfflineSync`.
 *
 * The hook orchestrates AppState listeners, a periodic probe, and
 * the AsyncStorage-backed offline queue. Each of those collaborators
 * is mocked so the suite remains deterministic and free of timers
 * (we drive the React-side state machine via the imperative
 * `flushNow` / `probeNow` returns).
 */

import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

/* ------------------------------------------------------------ Mocks ----- */

class MockApiError extends Error {
  public readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

const mockApiGet = jest.fn();

jest.mock("@/services/api", () => ({
  ApiError: MockApiError,
  apiClient: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

const mockUploadRecording = jest.fn();
jest.mock("@/services/assessments", () => ({
  uploadRecording: (...args: unknown[]) => mockUploadRecording(...args),
}));

interface QueueState {
  pending: Array<{ id: string; payload: unknown; retries: number }>;
  dead: Array<{ id: string; payload: unknown }>;
}
const mockQueueState: QueueState = { pending: [], dead: [] };
const mockListeners = new Set<(items: QueueState["pending"]) => void>();
const mockFlushFn = jest.fn();

jest.mock("@/services/offline-queue", () => ({
  flush: (...args: unknown[]) => mockFlushFn(...args),
  listPending: jest.fn(async () => mockQueueState.pending.slice()),
  listDeadLetter: jest.fn(async () => mockQueueState.dead.slice()),
  subscribe: (listener: (items: QueueState["pending"]) => void) => {
    mockListeners.add(listener);
    void Promise.resolve().then(() => listener(mockQueueState.pending.slice()));
    return () => mockListeners.delete(listener);
  },
}));

const mockAppStateRemove = jest.fn();
const mockAppStateSubscribers: Array<(state: string) => void> = [];

// We deliberately avoid `jest.mock("react-native", …)` — jest-expo's
// preset wires up component mocks at setup time and a manual override
// leaves the runtime in a half-initialized state. Spying on the real
// `AppState.addEventListener` is enough to capture the listener the
// hook registers without disturbing nativewind / RN internals.
import { AppState } from "react-native";

/* ------------------------------------------------------------ Imports --- */

import {
  useOfflineStore,
  __resetOfflineStoreForTests,
} from "@/stores/offline-store";
import {
  useOfflineSync,
  type UseOfflineSyncResult,
} from "@/hooks/useOfflineSync";

/* ------------------------------------------------------------ Harness --- */

interface HarnessProps {
  enabled?: boolean;
  upload?: (payload: unknown) => Promise<void>;
  probe?: () => Promise<boolean>;
  capture: (result: UseOfflineSyncResult) => void;
}

function Harness({ enabled, upload, probe, capture }: HarnessProps): null {
  const result = useOfflineSync({ enabled, upload, probe });
  capture(result);
  return null;
}

async function flushAsync(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
}

function seedQueue(payloads: Array<{ id: string }>): void {
  mockQueueState.pending = payloads.map((p) => ({
    id: p.id,
    payload: { assessmentId: p.id },
    retries: 0,
  }));
}

// Track every renderer created during a test so afterEach can unmount
// them inside `act(...)` — without this, a leftover Harness re-renders
// when the next test resets the zustand store and React emits a
// "not wrapped in act" warning that pollutes the suite output.
const activeRenderers: TestRenderer.ReactTestRenderer[] = [];

function mount(props: HarnessProps): TestRenderer.ReactTestRenderer {
  const renderer = TestRenderer.create(<Harness {...props} />);
  activeRenderers.push(renderer);
  return renderer;
}

beforeEach(() => {
  mockApiGet.mockReset();
  mockUploadRecording.mockReset();
  mockFlushFn.mockReset();
  mockAppStateRemove.mockReset();
  mockAppStateSubscribers.splice(0, mockAppStateSubscribers.length);
  mockListeners.clear();
  mockQueueState.pending = [];
  mockQueueState.dead = [];
  __resetOfflineStoreForTests();

  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((event, cb) => {
      if (event === "change") {
        mockAppStateSubscribers.push(cb as (state: string) => void);
      }
      return { remove: mockAppStateRemove } as unknown as ReturnType<
        typeof AppState.addEventListener
      >;
    });
});

afterEach(async () => {
  await act(async () => {
    while (activeRenderers.length > 0) {
      const r = activeRenderers.pop();
      r?.unmount();
    }
  });
  jest.restoreAllMocks();
});

/* ------------------------------------------------------------- Tests ---- */

describe("useOfflineSync", () => {
  it("hydrates the store on mount and exposes initial counters", async () => {
    seedQueue([{ id: "q-1" }, { id: "q-2" }]);
    const captures: UseOfflineSyncResult[] = [];
    await act(async () => {
      mount({ enabled: false, capture: (r) => captures.push(r) });
      await flushAsync();
    });
    const last = captures[captures.length - 1];
    expect(last?.pendingCount).toBe(2);
    expect(last?.deadCount).toBe(0);
    expect(last?.isOffline).toBe(false); // unknown != offline
  });

  it("flushNow drains the queue using the supplied upload function", async () => {
    seedQueue([{ id: "q-1" }]);
    const upload = jest.fn(async () => undefined);
    mockFlushFn.mockImplementation(
      async (uploadFn: (p: unknown) => Promise<void>) => {
        // The hook delegates to the real `flush` — emulate the contract:
        // invoke the uploader for each pending item then empty the queue.
        for (const item of mockQueueState.pending) {
          await uploadFn(item.payload);
        }
        mockQueueState.pending = [];
        return { attempted: 1, succeeded: 1, failed: 0, deadLettered: 0 };
      },
    );
    let captured: UseOfflineSyncResult | null = null;
    await act(async () => {
      mount({
        enabled: false,
        upload,
        capture: (r) => {
          captured = r;
        },
      });
      await flushAsync();
    });

    let result: unknown = null;
    await act(async () => {
      result = await (captured as unknown as UseOfflineSyncResult).flushNow();
      await flushAsync();
    });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ succeeded: 1, attempted: 1 });
    expect((captured as unknown as UseOfflineSyncResult).pendingCount).toBe(0);
    expect(useOfflineStore.getState().lastFlushAt).not.toBeNull();
  });

  it("flushNow returns null when there is nothing to send", async () => {
    let captured: UseOfflineSyncResult | null = null;
    await act(async () => {
      mount({
        enabled: false,
        capture: (r) => {
          captured = r;
        },
      });
      await flushAsync();
    });

    let result: unknown = "init";
    await act(async () => {
      result = await (captured as unknown as UseOfflineSyncResult).flushNow();
    });
    expect(result).toBeNull();
    expect(mockFlushFn).not.toHaveBeenCalled();
  });

  it("dedupes concurrent flushNow calls into a single in-flight request", async () => {
    seedQueue([{ id: "q-1" }, { id: "q-2" }]);
    let releaseFlush: () => void = () => {};
    mockFlushFn.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseFlush = () =>
            resolve({
              attempted: 2,
              succeeded: 2,
              failed: 0,
              deadLettered: 0,
            });
        }),
    );
    let captured: UseOfflineSyncResult | null = null;
    await act(async () => {
      mount({
        enabled: false,
        capture: (r) => {
          captured = r;
        },
      });
      await flushAsync();
    });

    let firstResult: unknown = null;
    let secondResult: unknown = null;
    await act(async () => {
      const a = (captured as unknown as UseOfflineSyncResult).flushNow();
      const b = (captured as unknown as UseOfflineSyncResult).flushNow();
      releaseFlush();
      [firstResult, secondResult] = await Promise.all([a, b]);
    });

    expect(mockFlushFn).toHaveBeenCalledTimes(1);
    expect(firstResult).toBe(secondResult);
  });

  it("probeNow toggles connectivity and triggers a flush when online", async () => {
    seedQueue([{ id: "q-1" }]);
    mockFlushFn.mockResolvedValue({
      attempted: 1,
      succeeded: 1,
      failed: 0,
      deadLettered: 0,
    });
    const probe = jest.fn(async () => true);
    let captured: UseOfflineSyncResult | null = null;
    await act(async () => {
      mount({
        enabled: false,
        probe,
        capture: (r) => {
          captured = r;
        },
      });
      await flushAsync();
    });

    await act(async () => {
      await (captured as unknown as UseOfflineSyncResult).probeNow();
      await flushAsync();
    });

    expect(probe).toHaveBeenCalledTimes(1);
    expect(useOfflineStore.getState().connectivity).toBe("online");
    expect(mockFlushFn).toHaveBeenCalledTimes(1);
  });

  it("marks the store offline when the probe reports a network failure", async () => {
    const probe = jest.fn(async () => false);
    let captured: UseOfflineSyncResult | null = null;
    await act(async () => {
      mount({
        enabled: false,
        probe,
        capture: (r) => {
          captured = r;
        },
      });
      await flushAsync();
    });

    await act(async () => {
      await (captured as unknown as UseOfflineSyncResult).probeNow();
    });

    expect(useOfflineStore.getState().connectivity).toBe("offline");
    expect((captured as unknown as UseOfflineSyncResult).isOffline).toBe(true);
    expect(mockFlushFn).not.toHaveBeenCalled();
  });

  it("subscribes to AppState only when enabled and cleans up on unmount", async () => {
    const probe = jest.fn(async () => true);
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      renderer = mount({
        enabled: true,
        probe,
        capture: () => undefined,
      });
      await flushAsync();
    });

    expect(mockAppStateSubscribers.length).toBe(1);
    // Probe fires once on initial enable.
    expect(probe).toHaveBeenCalled();

    await act(async () => {
      renderer?.unmount();
      // Remove the manually-unmounted entry so afterEach doesn't try
      // to unmount it a second time.
      const idx = activeRenderers.indexOf(renderer!);
      if (idx >= 0) activeRenderers.splice(idx, 1);
    });
    expect(mockAppStateRemove).toHaveBeenCalled();
  });
});
