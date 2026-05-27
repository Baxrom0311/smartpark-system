/**
 * Chunked upload session manager — provides resumable upload state
 * for audio recordings that exceed `CHUNK_THRESHOLD_BYTES` (2 MiB).
 *
 * Design constraints (per replan M43):
 *   - The backend currently accepts a SINGLE multipart per recording
 *     at `POST /assessments/:id/recordings`. We do NOT split the
 *     wire-level POST. The "chunking with resume" is therefore a
 *     client-side concern: we plan the file as fixed-size chunks,
 *     persist that plan with a stable `sessionId`, and use the
 *     session as an idempotency key (`X-Upload-Session` header).
 *
 *   - On a partial / failed upload we keep the session row so the
 *     offline-queue or the user can retry with the same key. On the
 *     next successful POST the session is cleared.
 *
 *   - The session also carries per-chunk `prepared` flags. A future
 *     iteration can hand the prep step (read+hash chunk from disk,
 *     compute integrity) off to a worker thread without changing the
 *     persistent shape — today the prep flag flips to `true` lazily
 *     just before the chunk would be transmitted.
 *
 * AsyncStorage layout:
 *   - `sado.mobile.chunkedUpload.v1` → `Record<sessionId, UploadSession>`
 *
 * Concurrency: a tiny in-memory promise-chain serialises mutations so
 * concurrent enqueues / flushes from different screens cannot tear
 * the session map.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "sado.mobile.chunkedUpload.v1";

export const CHUNK_THRESHOLD_BYTES = 2 * 1024 * 1024;
export const DEFAULT_CHUNK_SIZE_BYTES = 512 * 1024;
export const MIN_CHUNK_SIZE_BYTES = 64 * 1024;
export const MAX_CHUNK_SIZE_BYTES = 4 * 1024 * 1024;

export interface ChunkMeta {
  index: number;
  offset: number;
  length: number;
  prepared: boolean;
}

export interface UploadSession {
  id: string;
  fileUri: string;
  contentType: string;
  totalBytes: number;
  chunkSize: number;
  chunks: ChunkMeta[];
  retries: number;
  lastError: string | null;
  lastAttemptAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSessionInput {
  fileUri: string;
  contentType: string;
  totalBytes: number;
  chunkSize?: number;
  /** Optional hint to reuse an existing session by id (idempotency). */
  preferredId?: string;
}

type SessionMap = Record<string, UploadSession>;

let lock: Promise<unknown> = Promise.resolve();

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

function uid(): string {
  // Hermes lacks `crypto.randomUUID`. 96 bits of randomness is plenty
  // for a per-device idempotency key.
  const r = (): string =>
    Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, "0");
  return `cu_${Date.now().toString(36)}_${r()}${r()}`;
}

function clampChunkSize(size: number | undefined): number {
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
    return DEFAULT_CHUNK_SIZE_BYTES;
  }
  return Math.min(MAX_CHUNK_SIZE_BYTES, Math.max(MIN_CHUNK_SIZE_BYTES, Math.floor(size)));
}

async function readMap(): Promise<SessionMap> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as SessionMap;
    }
    return {};
  } catch {
    return {};
  }
}

async function writeMap(map: SessionMap): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/** Pure helper exposed for tests + UI progress meters. */
export function planChunks(
  totalBytes: number,
  chunkSize: number = DEFAULT_CHUNK_SIZE_BYTES,
): ChunkMeta[] {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return [];
  const size = clampChunkSize(chunkSize);
  const chunks: ChunkMeta[] = [];
  let offset = 0;
  let index = 0;
  while (offset < totalBytes) {
    const length = Math.min(size, totalBytes - offset);
    chunks.push({ index, offset, length, prepared: false });
    offset += length;
    index += 1;
  }
  return chunks;
}

/**
 * Returns true when a recording is large enough to benefit from
 * resumable session tracking. Files below the threshold can ride the
 * regular single-shot upload path without persisting state.
 */
export function shouldChunk(
  totalBytes: number,
  threshold: number = CHUNK_THRESHOLD_BYTES,
): boolean {
  return Number.isFinite(totalBytes) && totalBytes >= threshold;
}

export async function createSession(
  input: CreateSessionInput,
): Promise<UploadSession> {
  if (!Number.isFinite(input.totalBytes) || input.totalBytes <= 0) {
    throw new Error("createSession: totalBytes must be a positive number");
  }
  return withLock(async () => {
    const map = await readMap();
    const id = input.preferredId ?? uid();
    const now = Date.now();
    const chunkSize = clampChunkSize(input.chunkSize);
    const session: UploadSession = {
      id,
      fileUri: input.fileUri,
      contentType: input.contentType,
      totalBytes: input.totalBytes,
      chunkSize,
      chunks: planChunks(input.totalBytes, chunkSize),
      retries: 0,
      lastError: null,
      lastAttemptAt: null,
      createdAt: now,
      updatedAt: now,
    };
    map[id] = session;
    await writeMap(map);
    return session;
  });
}

export async function loadSession(id: string): Promise<UploadSession | null> {
  const map = await readMap();
  return map[id] ?? null;
}

export async function listSessions(): Promise<UploadSession[]> {
  const map = await readMap();
  return Object.values(map).sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeSession(id: string): Promise<void> {
  await withLock(async () => {
    const map = await readMap();
    if (map[id] !== undefined) {
      delete map[id];
      await writeMap(map);
    }
  });
}

/** Mark a single chunk as prepared (read off disk + verified). */
export async function markChunkPrepared(
  id: string,
  index: number,
): Promise<UploadSession | null> {
  return withLock(async () => {
    const map = await readMap();
    const session = map[id];
    if (!session) return null;
    const chunk = session.chunks[index];
    if (!chunk) return session;
    if (chunk.prepared) return session;
    session.chunks = session.chunks.map((c) =>
      c.index === index ? { ...c, prepared: true } : c,
    );
    session.updatedAt = Date.now();
    map[id] = session;
    await writeMap(map);
    return session;
  });
}

/** Resets all chunk-prepared flags. Used when a retry must redo prep. */
export async function resetChunkProgress(
  id: string,
): Promise<UploadSession | null> {
  return withLock(async () => {
    const map = await readMap();
    const session = map[id];
    if (!session) return null;
    session.chunks = session.chunks.map((c) => ({ ...c, prepared: false }));
    session.updatedAt = Date.now();
    map[id] = session;
    await writeMap(map);
    return session;
  });
}

export async function recordFailure(
  id: string,
  message: string,
): Promise<UploadSession | null> {
  return withLock(async () => {
    const map = await readMap();
    const session = map[id];
    if (!session) return null;
    const now = Date.now();
    session.retries += 1;
    session.lastError = message;
    session.lastAttemptAt = now;
    session.updatedAt = now;
    map[id] = session;
    await writeMap(map);
    return session;
  });
}

/** Convenience: progress in bytes (sum of prepared chunks' lengths). */
export function preparedBytes(session: UploadSession): number {
  return session.chunks.reduce(
    (acc, c) => (c.prepared ? acc + c.length : acc),
    0,
  );
}

/** Convenience: 0..1 fraction of bytes prepared. */
export function progressFraction(session: UploadSession): number {
  if (session.totalBytes <= 0) return 0;
  return Math.min(1, preparedBytes(session) / session.totalBytes);
}

/** Test-only helpers. Not exported from the package barrel. */
export const __testing = {
  reset: async (): Promise<void> => {
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
  storageKey: STORAGE_KEY,
};
