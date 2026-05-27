/**
 * Assessments API service.
 *
 * Provides typed wrappers around `/api/v1/assessments` and the
 * companion `/analysis/...` endpoints. Audio uploads use multipart
 * form data — the `file` parameter must be a path on disk produced by
 * the audio recorder (expo-av writes to a `file://` URI).
 */

import { Platform } from "react-native";

import { ApiError, apiClient } from "@/services/api";
import {
  createSession,
  loadSession,
  recordFailure as recordSessionFailure,
  removeSession,
  shouldChunk,
  type UploadSession,
} from "@/services/chunked-upload";
import {
  enqueue as enqueueOffline,
  type OfflineRecordingItem,
} from "@/services/offline-queue";
import type {
  Assessment,
  AssessmentAnalysis,
  AssessmentCreateRequest,
  AudioRecording,
  Page,
  RecordingTaskType,
} from "@/types";

export interface ListAssessmentsParams {
  cursor?: string | null;
  limit?: number;
  child_id?: string;
  status?: string;
  risk_level?: string;
}

export async function createAssessment(
  payload: AssessmentCreateRequest,
): Promise<Assessment> {
  return apiClient.post<Assessment>("/assessments", payload);
}

export async function listAssessments(
  params: ListAssessmentsParams = {},
): Promise<Page<Assessment>> {
  return apiClient.get<Page<Assessment>>("/assessments", {
    query: {
      cursor: params.cursor ?? undefined,
      limit: params.limit ?? 20,
      child_id: params.child_id ?? undefined,
      status: params.status ?? undefined,
      risk_level: params.risk_level ?? undefined,
    },
  });
}

export async function getAssessment(assessmentId: string): Promise<Assessment> {
  return apiClient.get<Assessment>(
    `/assessments/${encodeURIComponent(assessmentId)}`,
  );
}

export interface UploadRecordingInput {
  assessmentId: string;
  /** Local filesystem URI as returned by expo-av. */
  fileUri: string;
  taskType: RecordingTaskType;
  /** Mime type of the recording (audio/m4a, audio/wav, ...). */
  contentType: string;
  /** Client-measured duration in seconds. */
  durationSec: number;
  prompt?: string | null;
  /**
   * Total file size in bytes. When omitted (legacy callers) the
   * resumable session is skipped — small files go straight through
   * as a single multipart POST.
   */
  sizeBytes?: number | null;
  /**
   * Reuse an existing chunked-upload session id (e.g. when the
   * offline queue retries an already-planned upload). When omitted a
   * new session is created for files larger than
   * `CHUNK_THRESHOLD_BYTES`.
   */
  sessionId?: string | null;
}

/**
 * Ensure a chunked-upload session exists for large files. Returns
 * `null` for files below the threshold so callers can keep the
 * single-shot upload path. The function never throws on AsyncStorage
 * problems — failing to persist the session must not block the user
 * from uploading.
 */
async function ensureSession(
  input: UploadRecordingInput,
): Promise<UploadSession | null> {
  const totalBytes = input.sizeBytes ?? 0;
  if (!shouldChunk(totalBytes)) return null;

  try {
    if (input.sessionId) {
      const existing = await loadSession(input.sessionId);
      if (existing) return existing;
    }
    return await createSession({
      fileUri: input.fileUri,
      contentType: input.contentType,
      totalBytes,
      preferredId: input.sessionId ?? undefined,
    });
  } catch (error) {
    console.warn("[assessments] ensureSession failed", error);
    return null;
  }
}

/**
 * Determine a sane filename for the multipart payload — FastAPI uses
 * the filename to type-check the upload, and some Android pickers
 * silently strip the extension if we omit one.
 */
function inferFilename(fileUri: string, contentType: string): string {
  const trailing = fileUri.split("/").pop() ?? "recording";
  if (trailing.includes(".")) return trailing;
  const ext = (() => {
    if (contentType.includes("wav")) return "wav";
    if (contentType.includes("mp3") || contentType.includes("mpeg")) return "mp3";
    if (contentType.includes("m4a") || contentType.includes("mp4")) return "m4a";
    if (contentType.includes("aac")) return "aac";
    if (contentType.includes("ogg")) return "ogg";
    return "bin";
  })();
  return `${trailing}.${ext}`;
}

export async function uploadRecording(
  input: UploadRecordingInput,
): Promise<AudioRecording> {
  const formData = new FormData();

  // React Native's FormData accepts an object literal of
  // `{ uri, name, type }` for file uploads — TypeScript's lib does not
  // model that, so we cast at the boundary.
  const uri =
    Platform.OS === "android" || input.fileUri.startsWith("file://")
      ? input.fileUri
      : `file://${input.fileUri}`;

  formData.append(
    "audio",
    {
      uri,
      name: inferFilename(input.fileUri, input.contentType),
      type: input.contentType,
    } as unknown as Blob,
  );
  formData.append("task_type", input.taskType);
  formData.append("duration_sec", String(input.durationSec));
  if (input.prompt != null && input.prompt.length > 0) {
    formData.append("prompt", input.prompt);
  }

  const session = await ensureSession(input);

  // Idempotency headers are best-effort metadata. The server is free
  // to ignore them today; when the chunked endpoint lands they let
  // the API dedupe retries of the same recording without changing the
  // multipart contract.
  const headers: Record<string, string> = {};
  if (session) {
    headers["X-Upload-Session"] = session.id;
    headers["X-Upload-Total-Bytes"] = String(session.totalBytes);
    headers["X-Upload-Chunk-Size"] = String(session.chunkSize);
    headers["X-Upload-Chunk-Count"] = String(session.chunks.length);
  }

  try {
    const recording = await apiClient.request<AudioRecording>(
      `/assessments/${encodeURIComponent(input.assessmentId)}/recordings`,
      {
        method: "POST",
        formData,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      },
    );
    if (session) {
      // Successful upload — discard the resumable session.
      await removeSession(session.id).catch(() => {
        // Cleanup failure is non-fatal; the session row is harmless.
      });
    }
    return recording;
  } catch (error) {
    if (session) {
      const message = error instanceof Error ? error.message : String(error);
      await recordSessionFailure(session.id, message).catch(() => undefined);
    }
    throw error;
  }
}

/**
 * Result of {@link uploadOrQueueRecording} — either the upload
 * succeeded and the API returned the new recording row, or the
 * device was offline and we durably enqueued the payload for later.
 */
export type UploadOrQueueResult =
  | { status: "uploaded"; recording: AudioRecording }
  | { status: "queued"; queueItem: OfflineRecordingItem };

/**
 * Returns true when the failure looks like a connectivity problem we
 * should fall back to the offline queue for. Real API errors (4xx or
 * 5xx with a parsed body) bubble up so the UI surfaces them.
 *
 * Heuristic:
 *   - `ApiError` with status 0 (synthesised by the client when fetch
 *     itself rejected) → offline.
 *   - `ApiError` with status >= 500 in dev environments where the
 *     server is unreachable → offline.
 *   - Plain `TypeError`/`Error` from `fetch` → offline.
 */
function isOfflineFailure(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 0 || error.status === 503 || error.status === 504;
  }
  if (error instanceof Error) {
    const name = error.name.toLowerCase();
    if (name === "aborterror") return false;
    const message = error.message.toLowerCase();
    return (
      name === "typeerror" ||
      message.includes("network request failed") ||
      message.includes("failed to fetch") ||
      message.includes("network error") ||
      message.includes("timed out")
    );
  }
  return false;
}

/**
 * Try to upload immediately; on connectivity failure persist the
 * payload to the offline queue so a later flush can retry. Returns a
 * tagged result so callers can branch on `status`.
 *
 * Non-network errors (validation, auth, server bugs) re-throw —
 * those are surfaced to the user and not retried.
 *
 * For files larger than `CHUNK_THRESHOLD_BYTES` a resumable upload
 * session is registered up-front (see `services/chunked-upload`).
 * The session id is persisted alongside the queue payload so the
 * next flush keeps the same idempotency key.
 */
export async function uploadOrQueueRecording(
  input: UploadRecordingInput,
  options: { label?: string | null } = {},
): Promise<UploadOrQueueResult> {
  // Pre-register a session for large files so we have a stable
  // idempotency key for both the immediate upload and any retry that
  // happens after we fall back to the queue.
  let sessionId = input.sessionId ?? null;
  if (sessionId == null && shouldChunk(input.sizeBytes ?? 0)) {
    try {
      const created = await createSession({
        fileUri: input.fileUri,
        contentType: input.contentType,
        totalBytes: input.sizeBytes ?? 0,
      });
      sessionId = created.id;
    } catch (error) {
      // Session persistence is best-effort — fall back to a non-resumable
      // upload rather than blocking the user.
      console.warn("[assessments] createSession failed", error);
    }
  }

  const inputWithSession: UploadRecordingInput = sessionId
    ? { ...input, sessionId }
    : input;

  try {
    const recording = await uploadRecording(inputWithSession);
    return { status: "uploaded", recording };
  } catch (error) {
    if (!isOfflineFailure(error)) {
      throw error;
    }
    const queueItem = await enqueueOffline({
      assessmentId: input.assessmentId,
      fileUri: input.fileUri,
      taskType: input.taskType,
      contentType: input.contentType,
      durationSec: input.durationSec,
      prompt: input.prompt ?? null,
      label: options.label ?? null,
      sizeBytes: input.sizeBytes ?? null,
      sessionId,
    });
    return { status: "queued", queueItem };
  }
}

export async function getAnalysis(
  assessmentId: string,
): Promise<AssessmentAnalysis> {
  return apiClient.get<AssessmentAnalysis>(
    `/analysis/${encodeURIComponent(assessmentId)}`,
  );
}
