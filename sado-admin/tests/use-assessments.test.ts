/**
 * Tests for `buildLatestRiskMap` — the pure helper that reduces a
 * server-ordered list of assessments to the most recent risk per child.
 *
 * The backend returns assessments in `created_at desc` order, so the
 * helper relies on stable iteration: only the first time a child id
 * appears wins. We assert that ordering invariant explicitly.
 */

import { describe, expect, it } from "vitest";

import { buildLatestRiskMap } from "@/hooks/queries/use-assessments";
import type { Assessment } from "@/types";

function makeAssessment(overrides: Partial<Assessment>): Assessment {
  return {
    id: overrides.id ?? "a-1",
    child_id: overrides.child_id ?? "c-1",
    type: overrides.type ?? "screening",
    status: overrides.status ?? "completed",
    risk_level: overrides.risk_level ?? null,
    confidence: overrides.confidence ?? null,
    created_at: overrides.created_at ?? "2026-05-01T00:00:00Z",
    completed_at: overrides.completed_at ?? null,
  };
}

describe("buildLatestRiskMap", () => {
  it("returns an empty map when no assessments exist", () => {
    const map = buildLatestRiskMap([]);
    expect(map.size).toBe(0);
  });

  it("keeps the first occurrence per child (server ordered desc)", () => {
    const data: Assessment[] = [
      makeAssessment({
        id: "a3",
        child_id: "c-1",
        risk_level: "red",
        created_at: "2026-05-20T00:00:00Z",
        completed_at: "2026-05-20T00:01:00Z",
      }),
      makeAssessment({
        id: "a2",
        child_id: "c-1",
        risk_level: "yellow",
        created_at: "2026-05-10T00:00:00Z",
      }),
      makeAssessment({
        id: "a1",
        child_id: "c-1",
        risk_level: "green",
        created_at: "2026-05-01T00:00:00Z",
      }),
    ];

    const map = buildLatestRiskMap(data);
    expect(map.size).toBe(1);
    const entry = map.get("c-1");
    expect(entry).toBeDefined();
    expect(entry?.riskLevel).toBe("red");
    expect(entry?.assessmentId).toBe("a3");
    expect(entry?.completedAt).toBe("2026-05-20T00:01:00Z");
  });

  it("indexes multiple children independently", () => {
    const data: Assessment[] = [
      makeAssessment({
        id: "a1",
        child_id: "c-1",
        risk_level: "green",
        created_at: "2026-05-20T00:00:00Z",
      }),
      makeAssessment({
        id: "a2",
        child_id: "c-2",
        risk_level: "yellow",
        created_at: "2026-05-19T00:00:00Z",
      }),
      makeAssessment({
        id: "a3",
        child_id: "c-3",
        risk_level: "red",
        created_at: "2026-05-18T00:00:00Z",
      }),
    ];

    const map = buildLatestRiskMap(data);
    expect(map.size).toBe(3);
    expect(map.get("c-1")?.riskLevel).toBe("green");
    expect(map.get("c-2")?.riskLevel).toBe("yellow");
    expect(map.get("c-3")?.riskLevel).toBe("red");
  });

  it("preserves null risk levels for in-flight or failed assessments", () => {
    const data: Assessment[] = [
      makeAssessment({
        id: "a1",
        child_id: "c-1",
        risk_level: null,
        status: "processing",
      }),
    ];
    const map = buildLatestRiskMap(data);
    expect(map.get("c-1")?.riskLevel).toBeNull();
  });
});
