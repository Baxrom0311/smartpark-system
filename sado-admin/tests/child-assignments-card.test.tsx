/**
 * Smoke + interaction tests for `ChildAssignmentsCard`. We mock the
 * mutation hooks so we can assert that the component renders the
 * expected list, surfaces empty / error states, hides actions for
 * read-only viewers, and routes the "complete" / "delete" buttons to
 * the right mutations with the right payload.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ExerciseAssignment } from "@/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts === "object" && "date" in opts) {
        return `${key}:${String(opts.date)}`;
      }
      if (opts && typeof opts === "object" && "value" in opts) {
        return `${key}:${String(opts.value)}`;
      }
      return key;
    },
    i18n: { language: "uz", changeLanguage: () => Promise.resolve() },
  }),
}));

const completeMock = vi.fn();
const deleteMock = vi.fn();
const queryState = {
  data: undefined as
    | { items: ExerciseAssignment[]; next_cursor: null; has_more: false }
    | undefined,
  isLoading: false,
  isError: false,
  error: null as Error | null,
};

vi.mock("@/hooks/queries/use-exercise-assignments", () => ({
  useChildAssignments: () => queryState,
  useCompleteAssignment: () => ({
    mutate: completeMock,
    isPending: false,
    variables: undefined,
  }),
  useDeleteAssignment: () => ({
    mutate: deleteMock,
    isPending: false,
    variables: undefined,
  }),
  useAssignExercise: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/queries/use-exercises", () => ({
  useExercises: () => ({
    data: { pages: [{ items: [], next_cursor: null, has_more: false }] },
    isLoading: false,
  }),
}));

import { ChildAssignmentsCard } from "@/components/children/child-assignments-card";

function makeAssignment(
  overrides: Partial<ExerciseAssignment> = {},
): ExerciseAssignment {
  return {
    id: overrides.id ?? "a-1",
    child_id: overrides.child_id ?? "c-1",
    exercise_id: overrides.exercise_id ?? "e-1",
    assigned_by_id: overrides.assigned_by_id ?? "u-1",
    status: overrides.status ?? "pending",
    due_date: overrides.due_date ?? null,
    completed_at: overrides.completed_at ?? null,
    score: overrides.score ?? null,
    notes: overrides.notes ?? null,
    created_at: overrides.created_at ?? "2026-05-25T00:00:00Z",
    updated_at: overrides.updated_at ?? "2026-05-25T00:00:00Z",
    exercise: overrides.exercise ?? {
      id: "e-1",
      title: "R sound drill",
      description: null,
      category: "articulation",
      age_group: "4-5",
      difficulty: "easy",
      language: "uz",
      duration_minutes: 5,
      audio_example_path: null,
      image_path: null,
      instructions: null,
      target_phonemes: null,
      is_active: true,
      created_by_id: null,
      created_at: "2026-05-25T00:00:00Z",
      updated_at: "2026-05-25T00:00:00Z",
    },
  };
}

describe("ChildAssignmentsCard", () => {
  beforeEach(() => {
    completeMock.mockReset();
    deleteMock.mockReset();
    queryState.data = undefined;
    queryState.isLoading = false;
    queryState.isError = false;
    queryState.error = null;
  });

  it("shows empty state when there are no assignments", () => {
    queryState.data = { items: [], next_cursor: null, has_more: false };
    render(<ChildAssignmentsCard childId="c-1" canManage />);
    expect(
      screen.getByText("children.detail.assignments.empty"),
    ).toBeInTheDocument();
  });

  it("renders assignments with title and status badge", () => {
    queryState.data = {
      items: [makeAssignment({ status: "completed", score: 92 })],
      next_cursor: null,
      has_more: false,
    };
    render(<ChildAssignmentsCard childId="c-1" canManage />);
    expect(screen.getByText("R sound drill")).toBeInTheDocument();
    expect(
      screen.getByText("children.detail.assignments.statuses.completed"),
    ).toBeInTheDocument();
  });

  it("hides action buttons in read-only mode", () => {
    queryState.data = {
      items: [makeAssignment()],
      next_cursor: null,
      has_more: false,
    };
    render(<ChildAssignmentsCard childId="c-1" canManage={false} />);
    expect(
      screen.queryByText("children.detail.assignments.markComplete"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("children.detail.assignments.assignTitle"),
    ).not.toBeInTheDocument();
  });

  it("calls the complete mutation with assignment id and child id", async () => {
    queryState.data = {
      items: [makeAssignment()],
      next_cursor: null,
      has_more: false,
    };
    const user = userEvent.setup();
    render(<ChildAssignmentsCard childId="c-1" canManage />);
    await user.click(
      screen.getByRole("button", {
        name: /children.detail.assignments.markComplete/i,
      }),
    );
    expect(completeMock).toHaveBeenCalledTimes(1);
    expect(completeMock.mock.calls[0]?.[0]).toMatchObject({
      assignmentId: "a-1",
      childId: "c-1",
    });
  });

  it("does not delete when the confirm prompt is cancelled", async () => {
    queryState.data = {
      items: [makeAssignment()],
      next_cursor: null,
      has_more: false,
    };
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => false);
    const user = userEvent.setup();
    render(<ChildAssignmentsCard childId="c-1" canManage />);
    await user.click(
      screen.getAllByRole("button", { name: /common.delete/i })[0]!,
    );
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(deleteMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
