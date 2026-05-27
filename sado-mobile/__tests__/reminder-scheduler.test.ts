/**
 * Tests for `scheduleNextAssessmentReminder` — the auto-scheduler
 * that fires when an assessment completes.
 *
 * The underlying notification + preferences modules are mocked so
 * the suite runs on a vanilla Node runtime. We verify:
 *   - schedules a reminder when reminders are enabled & permission
 *     is granted, persisting `lastScheduledAt` and the assessment id
 *   - is idempotent for the same assessmentId (no double schedule)
 *   - skips when reminders are disabled in preferences
 *   - skips when permission is not granted (no prompt)
 *   - clears prefs when the OS rejects the schedule (past date)
 *   - cancels existing reminders before scheduling the new one
 *
 * NOTE: jest hoists `jest.mock` calls above all imports and forbids
 * the factory from touching out-of-scope identifiers — except those
 * prefixed with `mock` (case-insensitive). All shared state in this
 * file therefore uses the `mock*` naming convention and the mock
 * factory itself is self-contained.
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
    __memory: memory,
  };
});

const mockPermissionState: {
  value: "granted" | "denied" | "undetermined";
} = { value: "granted" };

interface MockSchedulePayload {
  childId: string;
  childName: string;
  scheduledFor: Date;
  titleTemplate: string;
  bodyTemplate: string;
}

const mockScheduleResult: {
  next: { identifier: string; childId: string; scheduledFor: string } | null;
} = { next: null };

const mockCancelCalls: { count: number } = { count: 0 };
const mockScheduleCalls: { calls: MockSchedulePayload[] } = { calls: [] };
const mockCancelOrder: number[] = [];
const mockScheduleOrder: number[] = [];
const mockCallCounter: { value: number } = { value: 0 };

jest.mock("@/services/notifications", () => ({
  cancelAllReminders: jest.fn(async () => {
    mockCancelCalls.count += 1;
    mockCallCounter.value += 1;
    mockCancelOrder.push(mockCallCounter.value);
  }),
  requestPermissions: jest.fn(async () => mockPermissionState.value),
  scheduleAssessmentReminder: jest.fn(async (input: MockSchedulePayload) => {
    mockScheduleCalls.calls.push(input);
    mockCallCounter.value += 1;
    mockScheduleOrder.push(mockCallCounter.value);
    if (mockScheduleResult.next !== null) return mockScheduleResult.next;
    return {
      identifier: `n-${input.childId}-${input.scheduledFor.getTime()}`,
      childId: input.childId,
      scheduledFor: input.scheduledFor.toISOString(),
    };
  }),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  scheduleNextAssessmentReminder,
  type ScheduleNextAssessmentInput,
} from "@/services/reminder-scheduler";
import {
  __testing,
  readReminderPreferences,
  updateReminderPreferences,
} from "@/services/preferences";
import {
  cancelAllReminders,
  requestPermissions,
  scheduleAssessmentReminder,
} from "@/services/notifications";

const memory = (
  AsyncStorage as unknown as { __memory: Map<string, string> }
).__memory;

const NOW = new Date("2026-05-01T12:00:00.000Z");

const baseInput: ScheduleNextAssessmentInput = {
  assessmentId: "a-1",
  childId: "c-1",
  childName: "Ali",
  titleTemplate: "Time for {name}",
  bodyTemplate: "{name} has a check waiting",
  now: NOW,
};

beforeEach(() => {
  memory.clear();
  mockPermissionState.value = "granted";
  mockScheduleResult.next = null;
  mockCancelCalls.count = 0;
  mockScheduleCalls.calls.splice(0, mockScheduleCalls.calls.length);
  mockCancelOrder.splice(0, mockCancelOrder.length);
  mockScheduleOrder.splice(0, mockScheduleOrder.length);
  mockCallCounter.value = 0;
  (cancelAllReminders as jest.Mock).mockClear();
  (requestPermissions as jest.Mock).mockClear();
  (scheduleAssessmentReminder as jest.Mock).mockClear();
});

describe("scheduleNextAssessmentReminder", () => {
  it("schedules a reminder using the parent's cadence when enabled", async () => {
    await updateReminderPreferences({ enabled: true, frequency: "biweekly" });

    const result = await scheduleNextAssessmentReminder(baseInput);

    expect(result.status).toBe("scheduled");
    if (result.status !== "scheduled") return;
    expect(result.frequency).toBe("biweekly");
    expect(result.scheduledFor.getTime()).toBe(
      NOW.getTime() + 14 * 24 * 60 * 60 * 1000,
    );
    expect(mockCancelCalls.count).toBe(1);
    expect(mockScheduleCalls.calls).toHaveLength(1);
    const stored = await readReminderPreferences();
    expect(stored.lastScheduledAssessmentId).toBe("a-1");
    expect(stored.lastScheduledAt).toBe(result.scheduledFor.toISOString());
  });

  it("is idempotent when called twice with the same assessmentId", async () => {
    await updateReminderPreferences({ enabled: true, frequency: "weekly" });

    const first = await scheduleNextAssessmentReminder(baseInput);
    expect(first.status).toBe("scheduled");

    const second = await scheduleNextAssessmentReminder(baseInput);
    expect(second.status).toBe("skipped");
    if (second.status === "skipped") {
      expect(second.reason).toBe("already-scheduled");
    }
    expect(mockScheduleCalls.calls).toHaveLength(1);
  });

  it("re-schedules for a new assessmentId after a previous schedule", async () => {
    await updateReminderPreferences({ enabled: true, frequency: "weekly" });

    await scheduleNextAssessmentReminder({ ...baseInput, assessmentId: "a-1" });
    const second = await scheduleNextAssessmentReminder({
      ...baseInput,
      assessmentId: "a-2",
    });

    expect(second.status).toBe("scheduled");
    expect(mockScheduleCalls.calls).toHaveLength(2);
    const stored = await readReminderPreferences();
    expect(stored.lastScheduledAssessmentId).toBe("a-2");
  });

  it("skips when reminders are disabled in preferences", async () => {
    await updateReminderPreferences({ enabled: false });

    const result = await scheduleNextAssessmentReminder(baseInput);

    expect(result.status).toBe("skipped");
    if (result.status === "skipped") {
      expect(result.reason).toBe("reminders-disabled");
    }
    expect(mockScheduleCalls.calls).toHaveLength(0);
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("skips when the OS denies permission and never prompts again", async () => {
    await updateReminderPreferences({ enabled: true, frequency: "weekly" });
    mockPermissionState.value = "denied";

    const result = await scheduleNextAssessmentReminder(baseInput);

    expect(result.status).toBe("skipped");
    if (result.status === "skipped") {
      expect(result.reason).toBe("permission-denied");
    }
    expect(mockScheduleCalls.calls).toHaveLength(0);
  });

  it("respects an explicit permissionOverride passed by the caller", async () => {
    await updateReminderPreferences({ enabled: true, frequency: "monthly" });

    const result = await scheduleNextAssessmentReminder({
      ...baseInput,
      permissionOverride: "denied",
    });

    expect(result.status).toBe("skipped");
    if (result.status === "skipped") {
      expect(result.reason).toBe("permission-denied");
    }
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("clears prefs and reports failure when the OS rejects the schedule", async () => {
    await updateReminderPreferences({
      enabled: true,
      frequency: "weekly",
      lastScheduledAt: "2026-01-01T00:00:00.000Z",
      lastScheduledAssessmentId: "older-assessment",
    });
    mockScheduleResult.next = null;
    // Force the next call to return null (=== OS rejected).
    (scheduleAssessmentReminder as jest.Mock).mockImplementationOnce(
      async (input: MockSchedulePayload) => {
        mockScheduleCalls.calls.push(input);
        mockCallCounter.value += 1;
        mockScheduleOrder.push(mockCallCounter.value);
        return null;
      },
    );

    const result = await scheduleNextAssessmentReminder(baseInput);

    expect(result.status).toBe("skipped");
    if (result.status === "skipped") {
      expect(result.reason).toBe("scheduling-failed");
    }
    const stored = await readReminderPreferences();
    expect(stored.lastScheduledAt).toBeNull();
    expect(stored.lastScheduledAssessmentId).toBeNull();
  });

  it("cancels existing reminders before scheduling the new one", async () => {
    await updateReminderPreferences({ enabled: true, frequency: "weekly" });

    await scheduleNextAssessmentReminder(baseInput);

    // Order matters: cancel must happen before the new schedule call
    // so the user only ever has one reminder queued.
    expect(mockCancelOrder).toHaveLength(1);
    expect(mockScheduleOrder).toHaveLength(1);
    expect(mockCancelOrder[0]!).toBeLessThan(mockScheduleOrder[0]!);
  });

  it("normalises a malformed lastScheduledAssessmentId in storage to null", async () => {
    // Simulate an older client that wrote a numeric id by accident.
    memory.set(
      __testing.STORAGE_KEY,
      JSON.stringify({
        enabled: true,
        frequency: "weekly",
        lastScheduledAt: null,
        lastScheduledAssessmentId: 42,
      }),
    );

    const result = await scheduleNextAssessmentReminder(baseInput);
    expect(result.status).toBe("scheduled");
    expect(mockScheduleCalls.calls).toHaveLength(1);
  });
});
