/**
 * Tests for the chunked-upload session manager.
 *
 * Verifies the pure helpers (`planChunks`, `shouldChunk`,
 * `progressFraction`) and the AsyncStorage-backed CRUD surface.
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
  CHUNK_THRESHOLD_BYTES,
  DEFAULT_CHUNK_SIZE_BYTES,
  __testing,
  createSession,
  listSessions,
  loadSession,
  markChunkPrepared,
  planChunks,
  preparedBytes,
  progressFraction,
  recordFailure,
  removeSession,
  resetChunkProgress,
  shouldChunk,
} from "@/services/chunked-upload";

beforeEach(async () => {
  await __testing.reset();
});

describe("planChunks", () => {
  it("returns an empty plan for non-positive sizes", () => {
    expect(planChunks(0)).toEqual([]);
    expect(planChunks(-1)).toEqual([]);
    expect(planChunks(Number.NaN)).toEqual([]);
  });

  it("splits a file into fixed-size chunks with a tail", () => {
    const chunks = planChunks(1_500_000, 512_000);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toMatchObject({ index: 0, offset: 0, length: 512_000 });
    expect(chunks[1]).toMatchObject({ index: 1, offset: 512_000, length: 512_000 });
    expect(chunks[2]).toMatchObject({
      index: 2,
      offset: 1_024_000,
      length: 1_500_000 - 1_024_000,
    });
    expect(chunks.every((c) => c.prepared === false)).toBe(true);
  });

  it("falls back to the default chunk size when given a bogus override", () => {
    const chunks = planChunks(1_500_000, 0);
    const expected = Math.ceil(1_500_000 / DEFAULT_CHUNK_SIZE_BYTES);
    expect(chunks).toHaveLength(expected);
  });

  it("clamps absurdly small chunk sizes to the lower bound", () => {
    const chunks = planChunks(200_000, 1_000);
    // The minimum is 64 KiB so a 200KB file fits in a few chunks.
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]?.length).toBeGreaterThanOrEqual(64 * 1024 - 1);
  });
});

describe("shouldChunk", () => {
  it("matches the documented threshold", () => {
    expect(shouldChunk(0)).toBe(false);
    expect(shouldChunk(CHUNK_THRESHOLD_BYTES - 1)).toBe(false);
    expect(shouldChunk(CHUNK_THRESHOLD_BYTES)).toBe(true);
    expect(shouldChunk(CHUNK_THRESHOLD_BYTES * 4)).toBe(true);
  });

  it("returns false for non-finite inputs", () => {
    expect(shouldChunk(Number.NaN)).toBe(false);
    // Infinity isn't a "finite" number, so the helper rejects it
    // even though `Infinity >= threshold` would otherwise be true.
    expect(shouldChunk(Number.POSITIVE_INFINITY)).toBe(false);
    expect(shouldChunk(Number.NEGATIVE_INFINITY)).toBe(false);
  });
});

describe("session CRUD", () => {
  const baseInput = {
    fileUri: "file:///tmp/large.m4a",
    contentType: "audio/m4a",
    totalBytes: 3 * 1024 * 1024,
  };

  it("creates a session with chunk metadata", async () => {
    const session = await createSession(baseInput);
    expect(session.id).toMatch(/^cu_/);
    expect(session.totalBytes).toBe(baseInput.totalBytes);
    expect(session.chunks.length).toBeGreaterThan(0);
    expect(session.chunks.every((c) => c.prepared === false)).toBe(true);
    expect(progressFraction(session)).toBe(0);
  });

  it("rejects non-positive totalBytes", async () => {
    await expect(createSession({ ...baseInput, totalBytes: 0 })).rejects.toThrow();
  });

  it("loads a previously persisted session", async () => {
    const created = await createSession(baseInput);
    const loaded = await loadSession(created.id);
    expect(loaded?.id).toBe(created.id);
    expect(loaded?.fileUri).toBe(baseInput.fileUri);
  });

  it("returns null when loading an unknown id", async () => {
    await expect(loadSession("missing")).resolves.toBeNull();
  });

  it("reuses a preferred id when supplied", async () => {
    const created = await createSession({ ...baseInput, preferredId: "fixed-id" });
    expect(created.id).toBe("fixed-id");
    const loaded = await loadSession("fixed-id");
    expect(loaded).not.toBeNull();
  });

  it("marks chunks prepared and updates progress", async () => {
    const created = await createSession(baseInput);
    const after = await markChunkPrepared(created.id, 0);
    expect(after?.chunks[0]?.prepared).toBe(true);
    expect(preparedBytes(after!)).toBe(after!.chunks[0]?.length);
    // Marking the same chunk twice is idempotent.
    const again = await markChunkPrepared(created.id, 0);
    expect(again?.chunks[0]?.prepared).toBe(true);
  });

  it("ignores chunk-prepared calls for missing indexes / sessions", async () => {
    const created = await createSession(baseInput);
    const after = await markChunkPrepared(created.id, 999);
    expect(after?.chunks.every((c) => !c.prepared)).toBe(true);
    await expect(markChunkPrepared("missing", 0)).resolves.toBeNull();
  });

  it("resets prepared flags via resetChunkProgress", async () => {
    const created = await createSession(baseInput);
    await markChunkPrepared(created.id, 0);
    await markChunkPrepared(created.id, 1);
    const reset = await resetChunkProgress(created.id);
    expect(reset?.chunks.every((c) => c.prepared === false)).toBe(true);
  });

  it("records failures by incrementing retries and storing the message", async () => {
    const created = await createSession(baseInput);
    const after = await recordFailure(created.id, "network down");
    expect(after?.retries).toBe(1);
    expect(after?.lastError).toBe("network down");
    expect(after?.lastAttemptAt).toBeGreaterThan(0);

    const again = await recordFailure(created.id, "still down");
    expect(again?.retries).toBe(2);
    expect(again?.lastError).toBe("still down");
  });

  it("removes sessions by id", async () => {
    const a = await createSession(baseInput);
    const b = await createSession({ ...baseInput, fileUri: "file:///tmp/b.m4a" });
    await removeSession(a.id);
    const all = await listSessions();
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe(b.id);
  });
});
