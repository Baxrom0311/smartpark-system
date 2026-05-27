/**
 * Tests for the exercises API service.
 *
 * We stub `fetch` so the tests run on a Node runtime without a real
 * backend. The token storage is also stubbed so requests don't trip
 * over the refresh logic.
 */

jest.mock("expo-secure-store", () => {
  const memory = new Map<string, string>();
  return {
    WHEN_UNLOCKED: "afterFirstUnlockThisDeviceOnly",
    setItemAsync: jest.fn(async (key: string, value: string) => {
      memory.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => memory.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      memory.delete(key);
    }),
  };
});

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
  };
});

import { writeTokens, clearTokens } from "@/services/token-storage";
import {
  assignExercise,
  completeAssignment,
  listAllChildAssignments,
  listExercises,
} from "@/services/exercises";

interface FetchCall {
  url: string;
  init: RequestInit;
}

function makeJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("services/exercises", () => {
  let calls: FetchCall[] = [];

  beforeEach(async () => {
    calls = [];
    await clearTokens();
    await writeTokens({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      expiresIn: 900,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("listExercises sends pagination + filter query", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockImplementation(async (url, init) => {
        calls.push({ url: String(url), init: (init ?? {}) as RequestInit });
        return makeJsonResponse({
          items: [],
          next_cursor: null,
          has_more: false,
        });
      });

    await listExercises({ language: "uz", category: "articulation", limit: 5 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const sent = calls[0];
    expect(sent).toBeDefined();
    if (!sent) throw new Error("no fetch call");
    expect(sent.url).toContain("/exercises?");
    expect(sent.url).toContain("language=uz");
    expect(sent.url).toContain("category=articulation");
    expect(sent.url).toContain("limit=5");
    expect(sent.init.method ?? "GET").toBe("GET");
  });

  it("listAllChildAssignments paginates until has_more=false", async () => {
    const sequences = [
      makeJsonResponse({
        items: [{ id: "a-1" }, { id: "a-2" }],
        next_cursor: "cursor-1",
        has_more: true,
      }),
      makeJsonResponse({
        items: [{ id: "a-3" }],
        next_cursor: null,
        has_more: false,
      }),
    ];
    jest.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      calls.push({ url: String(url), init: (init ?? {}) as RequestInit });
      return sequences.shift() as Response;
    });

    const items = await listAllChildAssignments("c-1");
    expect(items.map((a) => a.id)).toEqual(["a-1", "a-2", "a-3"]);
    expect(calls).toHaveLength(2);
    const second = calls[1];
    expect(second).toBeDefined();
    if (!second) throw new Error("no second call");
    expect(second.url).toContain("cursor=cursor-1");
  });

  it("assignExercise POSTs the exercise id to the assignment endpoint", async () => {
    jest.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      calls.push({ url: String(url), init: (init ?? {}) as RequestInit });
      return makeJsonResponse({
        id: "asg-1",
        child_id: "c-1",
        exercise_id: "ex-1",
        status: "pending",
        assigned_by_id: "u-1",
        due_date: null,
        completed_at: null,
        score: null,
        notes: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        exercise: null,
      });
    });

    const assignment = await assignExercise("c-1", { exercise_id: "ex-1" });
    expect(assignment.id).toBe("asg-1");
    const sent = calls[0];
    expect(sent).toBeDefined();
    if (!sent) throw new Error("no fetch call");
    expect(sent.url).toContain("/exercises/c-1/assign");
    expect(sent.init.method).toBe("POST");
    expect(JSON.parse(String(sent.init.body))).toEqual({
      exercise_id: "ex-1",
    });
  });

  it("completeAssignment hits the dedicated /complete endpoint", async () => {
    jest.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      calls.push({ url: String(url), init: (init ?? {}) as RequestInit });
      return makeJsonResponse({
        id: "asg-1",
        child_id: "c-1",
        exercise_id: "ex-1",
        status: "completed",
        assigned_by_id: "u-1",
        due_date: null,
        completed_at: "2026-01-01T00:00:00Z",
        score: 90,
        notes: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        exercise: null,
      });
    });

    const updated = await completeAssignment("asg-1", { score: 90 });
    expect(updated.status).toBe("completed");
    const sent = calls[0];
    expect(sent).toBeDefined();
    if (!sent) throw new Error("no fetch call");
    expect(sent.url).toContain("/exercises/assignments/asg-1/complete");
    expect(sent.init.method).toBe("PUT");
  });
});
