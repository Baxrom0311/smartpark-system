/**
 * Tests for the in-memory assessment session store.
 *
 * The store is just a Zustand wrapper but it backs the entire game
 * flow, so we exercise the start/append/reset transitions to guard
 * against accidental regressions.
 */

import {
  DEFAULT_PROMPTS,
  useAssessmentStore,
} from "@/stores/assessment-store";
import type { Assessment, AudioRecording } from "@/types";

const mockAssessment: Assessment = {
  id: "a-1",
  child_id: "c-1",
  created_by_id: "u-1",
  type: "screening",
  status: "pending",
  overall_risk: null,
  overall_confidence: null,
  summary: null,
  started_at: null,
  completed_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  recordings: [],
};

function makeRecording(id: string): AudioRecording {
  return {
    id,
    assessment_id: "a-1",
    task_type: "repeat_word",
    prompt: "olma",
    storage_key: `recordings/a-1/${id}.m4a`,
    content_type: "audio/m4a",
    size_bytes: 1024,
    duration_sec: 1.5,
    sample_rate: 44100,
    processed: false,
    processing_error: null,
    processed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("assessment-store", () => {
  beforeEach(() => {
    useAssessmentStore.getState().reset();
  });

  it("starts a session with the default prompts and zero step", () => {
    useAssessmentStore.getState().startSession(mockAssessment, "c-1");
    const state = useAssessmentStore.getState();
    expect(state.assessment?.id).toBe("a-1");
    expect(state.childId).toBe("c-1");
    expect(state.step).toBe(0);
    expect(state.totalSteps).toBe(DEFAULT_PROMPTS.length);
    expect(state.uploaded).toHaveLength(0);
  });

  it("appends recordings without resetting the step", () => {
    useAssessmentStore.getState().startSession(mockAssessment, "c-1");
    useAssessmentStore.getState().goToStep(1);
    useAssessmentStore.getState().appendRecording(makeRecording("r-1"));
    useAssessmentStore.getState().appendRecording(makeRecording("r-2"));
    const state = useAssessmentStore.getState();
    expect(state.uploaded.map((r) => r.id)).toEqual(["r-1", "r-2"]);
    expect(state.step).toBe(1);
  });

  it("resets back to a clean session", () => {
    useAssessmentStore.getState().startSession(mockAssessment, "c-1");
    useAssessmentStore.getState().appendRecording(makeRecording("r-1"));
    useAssessmentStore.getState().reset();
    const state = useAssessmentStore.getState();
    expect(state.assessment).toBeNull();
    expect(state.childId).toBeNull();
    expect(state.step).toBe(0);
    expect(state.uploaded).toHaveLength(0);
  });
});
