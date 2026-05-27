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

  return apiClient.request<AudioRecording>(
    `/assessments/${encodeURIComponent(input.assessmentId)}/recordings`,
    {
      method: "POST",
      formData,
    },
  );
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
 */
export async function uploadOrQueueRecording(
  input: UploadRecordingInput,
  options: { label?: string | null } = {},
): Promise<UploadOrQueueResult> {
  try {
    const recording = await uploadRecording(input);
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
