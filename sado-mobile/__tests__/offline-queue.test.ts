/**
 * Offline queue unit tests.
 *
 * Exercises enqueue/list/flush/dead-letter semantics against an
 * in-memory mock of AsyncStorage. The queue must:
 *   - persist across reads
 *   - drain successfully when the upload callback resolves
 *   - increment retries and dead-letter after MAX_RETRIES failures
 *   - allow requeue of dead-lettered items
 */

jest.mock("@react-native-async-storage/async-storage", () => {
  const memory = new Map<string, string>();
  return {
    setItem: jest.fn(async (key: string, value: string) => {
      memory.set(key, value);
    }),
    getItem: jest.fn(async (key: string) => memory.get(key) ?? null),
    removeItem: jest.fn(async (key: string) => {
      memory.delete(key);
    }),
    clear: jest.fn(async () => {
      memory.clear();
    }),
  };
});

import {
  MAX_RETRIES,
  __testing,
  discardDeadLetter,
  enqueue,
  flush,
  listDeadLetter,
  listPending,
  remove,
  requeueDeadLetter,
  type OfflineRecordingPayload,
} from "@/services/offline-queue";

function payload(
  overrides: Partial<OfflineRecordingPayload> = {},
): OfflineRecordingPayload {
  return {
    assessmentId: "a-1",
    fileUri: "file:///tmp/r.m4a",
    taskType: "repeat_word",
    contentType: "audio/m4a",
    durationSec: 1.2,
    prompt: "olma",
    label: "Apple",
    ...overrides,
  };
}

describe("offline-queue", () => {
  beforeEach(async () => {
    await __testing.reset();
  });

  it("persists enqueued items", async () => {
    const item = await enqueue(payload());
    expect(item.id).toMatch(/^oq_/);

    const pending = await listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.payload.assessmentId).toBe("a-1");
    expect(pending[0]?.retries).toBe(0);
  });

  it("removes items by id", async () => {
    const a = await enqueue(payload({ assessmentId: "a-1" }));
    await enqueue(payload({ assessmentId: "a-2" }));
    await remove(a.id);
    const pending = await listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.payload.assessmentId).toBe("a-2");
  });

  it("drains the queue on a successful flush", async () => {
    await enqueue(payload({ assessmentId: "a-1" }));
    await enqueue(payload({ assessmentId: "a-2" }));

    const upload = jest.fn(async () => undefined);
    const result = await flush(upload);

    expect(upload).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      attempted: 2,
      succeeded: 2,
      failed: 0,
      deadLettered: 0,
    });
    expect(await listPending()).toHaveLength(0);
  });

  it("retains failed items and increments retries", async () => {
    await enqueue(payload());
    const upload = jest.fn(async () => {
      throw new Error("network down");
    });

    const result = await flush(upload);
    expect(result.failed).toBe(1);
    expect(result.deadLettered).toBe(0);

    const pending = await listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.retries).toBe(1);
    expect(pending[0]?.lastError).toBe("network down");
    expect(pending[0]?.lastAttemptAt).toBeGreaterThan(0);
  });

  it("dead-letters items after MAX_RETRIES failures", async () => {
    await enqueue(payload());
    const upload = jest.fn(async () => {
      throw new Error("boom");
    });

    for (let i = 0; i < MAX_RETRIES; i += 1) {
      // Each flush retries the same item once.
      // eslint-disable-next-line no-await-in-loop
      await flush(upload);
    }

    expect(await listPending()).toHaveLength(0);
    const dead = await listDeadLetter();
    expect(dead).toHaveLength(1);
    expect(dead[0]?.retries).toBe(MAX_RETRIES);
  });

  it("requeues and discards dead-letter items", async () => {
    await enqueue(payload());
    const failing = jest.fn(async () => {
      throw new Error("boom");
    });
    for (let i = 0; i < MAX_RETRIES; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await flush(failing);
    }
    const dead = await listDeadLetter();
    expect(dead).toHaveLength(1);

    const deadId = dead[0]?.id;
    if (!deadId) throw new Error("dead id missing");
    await requeueDeadLetter(deadId);

    expect(await listDeadLetter()).toHaveLength(0);
    const pending = await listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.retries).toBe(0);
    expect(pending[0]?.lastError).toBeNull();

    // discard branch
    await flush(failing);
    for (let i = 0; i < MAX_RETRIES - 1; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await flush(failing);
    }
    const dead2 = await listDeadLetter();
    const dead2Id = dead2[0]?.id;
    if (!dead2Id) throw new Error("dead2 id missing");
    await discardDeadLetter(dead2Id);
    expect(await listDeadLetter()).toHaveLength(0);
  });

  it("returns a no-op result when the queue is empty", async () => {
    const upload = jest.fn(async () => undefined);
    const result = await flush(upload);
    expect(upload).not.toHaveBeenCalled();
    expect(result).toEqual({
      attempted: 0,
      succeeded: 0,
      failed: 0,
      deadLettered: 0,
    });
  });
});
