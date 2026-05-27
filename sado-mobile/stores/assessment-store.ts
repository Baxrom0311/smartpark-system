/**
 * Assessment store.
 *
 * Tracks the in-flight assessment session so the user can move
 * between the `index → game → results` screens without losing state.
 *
 * The store deliberately avoids persisting beyond the process lifetime
 * — incomplete assessments are discarded on app restart. Completed
 * assessments live in TanStack Query / on the backend.
 */

import { create } from "zustand";

import type { Assessment, AudioRecording, RecordingTaskType } from "@/types";

/**
 * Static prompts the child needs to repeat. We keep this client-side
 * because the API doesn't ship per-task prompts yet — for the demo
 * each child sees the same three Uzbek words.
 */
export interface AssessmentPrompt {
  taskType: RecordingTaskType;
  prompt: string;
}

export const DEFAULT_PROMPTS: readonly AssessmentPrompt[] = [
  { taskType: "repeat_word", prompt: "Olma" },
  { taskType: "repeat_word", prompt: "Quyosh" },
  { taskType: "repeat_word", prompt: "Maktab" },
];

interface AssessmentSessionState {
  assessment: Assessment | null;
  childId: string | null;
  step: number;
  totalSteps: number;
  uploaded: AudioRecording[];
  prompts: readonly AssessmentPrompt[];

  startSession: (assessment: Assessment, childId: string) => void;
  appendRecording: (recording: AudioRecording) => void;
  goToStep: (step: number) => void;
  reset: () => void;
}

export const useAssessmentStore = create<AssessmentSessionState>((set) => ({
  assessment: null,
  childId: null,
  step: 0,
  totalSteps: DEFAULT_PROMPTS.length,
  uploaded: [],
  prompts: DEFAULT_PROMPTS,

  startSession: (assessment, childId) =>
    set({
      assessment,
      childId,
      step: 0,
      uploaded: [],
      totalSteps: DEFAULT_PROMPTS.length,
      prompts: DEFAULT_PROMPTS,
    }),

  appendRecording: (recording) =>
    set((state) => ({ uploaded: [...state.uploaded, recording] })),

  goToStep: (step) => set({ step }),

  reset: () =>
    set({
      assessment: null,
      childId: null,
      step: 0,
      uploaded: [],
      totalSteps: DEFAULT_PROMPTS.length,
      prompts: DEFAULT_PROMPTS,
    }),
}));

export const selectActiveAssessment = (state: AssessmentSessionState) =>
  state.assessment;
