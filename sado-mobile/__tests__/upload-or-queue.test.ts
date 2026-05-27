/**
 * Tests for `uploadOrQueueRecording` — the offline-aware wrapper
 * around the API upload. These tests stub the actual `apiClient` so
 * we can deterministically simulate network failures without running
 * a real fetch.
 */

jest.mock("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }));

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

const mockRequest = jest.fn();
jest.mock("@/services/api", () => {
  const actual = jest.requireActual("@/services/api");
  return {
    ...actual,
    apiClient: {
      request: (...args: unknown[]) => mockRequest(...args),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    },
  };
});

import { ApiError } from "@/services/api";
import { uploadOrQueueRecording } from "@/services/assessments";
import {
  __testing,
  listPending,
  type OfflineRecordingPayload,
} from "@/services/offline-queue";

const baseInput = {
  assessmentId: "assessment-123",
  fileUri: "file:///tmp/recording.m4a",
  taskType: "repeat_word" as const,
  contentType: "audio/m4a",
  durationSec: 2.5,
  prompt: "olma",
};

beforeEach(async () => {
  mockRequest.mockReset();
  await __testing.reset();
});

describe("uploadOrQueueRecording", () => {
  it("returns 'uploaded' when the API accepts the recording", async () => {
    mockRequest.mockResolvedValueOnce({
      id: "rec-1",
      assessment_id: baseInput.assessmentId,
      task_type: baseInput.taskType,
      duration_sec: baseInput.durationSec,
      processed: false,
      created_at: new Date().toISOString(),
    });

    const result = await uploadOrQueueRecording(baseInput);

    expect(result.status).toBe("uploaded");
    if (result.status === "uploaded") {
      expect(result.recording.id).toBe("rec-1");
    }
    expect(mockRequest).toHaveBeenCalledTimes(1);
    await expect(listPending()).resolves.toEqual([]);
  });

  it("falls back to the offline queue on a network failure", async () => {
    const networkError = Object.assign(new TypeError("Network request failed"), {
      name: "TypeError",
    });
    mockRequest.mockRejectedValueOnce(networkError);

    const result = await uploadOrQueueRecording(baseInput, { label: "olma" });

    expect(result.status).toBe("queued");
    if (result.status === "queued") {
      expect(result.queueItem.payload.assessmentId).toBe(baseInput.assessmentId);
      expect(result.queueItem.payload.label).toBe("olma");
      expect(result.queueItem.retries).toBe(0);
    }
    const pending = await listPending();
    expect(pending).toHaveLength(1);
    const payload: OfflineRecordingPayload = pending[0]!.payload;
    expect(payload.assessmentId).toBe(baseInput.assessmentId);
    expect(payload.fileUri).toBe(baseInput.fileUri);
    expect(payload.prompt).toBe("olma");
  });

  it("falls back when the client surfaces a synthetic 'status 0' ApiError", async () => {
    mockRequest.mockRejectedValueOnce(
      new ApiError("network down", 0, "NETWORK"),
    );

    const result = await uploadOrQueueRecording(baseInput);

    expect(result.status).toBe("queued");
    await expect(listPending()).resolves.toHaveLength(1);
  });

  it("re-throws non-network ApiErrors instead of queuing them", async () => {
    mockRequest.mockRejectedValueOnce(
      new ApiError("validation failed", 422, "INVALID"),
    );

    await expect(uploadOrQueueRecording(baseInput)).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(listPending()).resolves.toEqual([]);
  });

  it("treats AbortError as a non-fallback failure", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    mockRequest.mockRejectedValueOnce(abort);

    await expect(uploadOrQueueRecording(baseInput)).rejects.toThrow("aborted");
    await expect(listPending()).resolves.toEqual([]);
  });
});
