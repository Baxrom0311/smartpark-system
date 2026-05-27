/**
 * Push notifications service unit tests.
 *
 * The native `expo-notifications` module is mocked so the suite runs
 * on a vanilla Node runtime. Tests cover:
 *   - permission request (granted / denied / undetermined)
 *   - token resolution + persistence + backend sync
 *   - graceful 404 handling for the (in-progress) backend endpoint
 *   - reminder scheduling (filters out past dates) + cancellation
 *
 * NOTE: jest hoists `jest.mock` calls above all imports and forbids
 * the factory from touching out-of-scope identifiers — except those
 * prefixed with `mock` (case-insensitive). All shared state in this
 * file therefore uses the `mock*` naming convention.
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
  };
});

const mockPermissionState: {
  value: "granted" | "denied" | "undetermined";
} = { value: "undetermined" };

const mockTokenState: { value: string | null; throwOnce: boolean } = {
  value: "ExponentPushToken[abc-123]",
  throwOnce: false,
};

interface MockScheduledEntry {
  identifier: string;
  content: { title?: string; body?: string; data?: Record<string, unknown> };
}

const mockScheduledStore: MockScheduledEntry[] = [];
const mockIdentifierCounter: { value: number } = { value: 0 };

jest.mock("expo-notifications", () => {
  return {
    AndroidImportance: { DEFAULT: 3, HIGH: 4 },
    AndroidNotificationVisibility: { PUBLIC: 1 },
    SchedulableTriggerInputTypes: { DATE: "date" },
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => undefined),
    getPermissionsAsync: jest.fn(async () => ({
      granted: mockPermissionState.value === "granted",
      canAskAgain: true,
      status: mockPermissionState.value,
    })),
    requestPermissionsAsync: jest.fn(async () => ({
      granted: mockPermissionState.value === "granted",
      canAskAgain: true,
      status: mockPermissionState.value,
    })),
    getExpoPushTokenAsync: jest.fn(async () => {
      if (mockTokenState.throwOnce) {
        mockTokenState.throwOnce = false;
        throw new Error("simulator cannot register");
      }
      if (mockTokenState.value === null) return { data: "" };
      return { data: mockTokenState.value };
    }),
    scheduleNotificationAsync: jest.fn(async ({ content }) => {
      mockIdentifierCounter.value += 1;
      const identifier = `n-${mockIdentifierCounter.value}`;
      mockScheduledStore.push({ identifier, content });
      return identifier;
    }),
    cancelScheduledNotificationAsync: jest.fn(async (identifier: string) => {
      const idx = mockScheduledStore.findIndex(
        (e) => e.identifier === identifier,
      );
      if (idx >= 0) mockScheduledStore.splice(idx, 1);
    }),
    cancelAllScheduledNotificationsAsync: jest.fn(async () => {
      mockScheduledStore.splice(0, mockScheduledStore.length);
    }),
    getAllScheduledNotificationsAsync: jest.fn(async () => [
      ...mockScheduledStore,
    ]),
    addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    addNotificationResponseReceivedListener: jest.fn(() => ({
      remove: jest.fn(),
    })),
  };
});

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: { version: "0.1.0", extra: { eas: { projectId: "p-1" } } },
    easConfig: { projectId: "p-1" },
  },
}));

const mockApiPostCalls: Array<{ path: string; body: unknown }> = [];
const mockApiPostError: { error: unknown | null } = { error: null };

jest.mock("@/services/api", () => {
  class ApiError extends Error {
    public readonly status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
      this.name = "ApiError";
    }
  }
  return {
    ApiError,
    apiClient: {
      post: jest.fn(async (path: string, body: unknown) => {
        mockApiPostCalls.push({ path, body });
        if (mockApiPostError.error) {
          throw mockApiPostError.error;
        }
        return undefined;
      }),
    },
  };
});

import {
  __testing,
  cancelAllReminders,
  cancelReminder,
  getRegisteredDevice,
  listScheduledReminders,
  registerForPushNotifications,
  requestPermissions,
  scheduleAssessmentReminder,
  unregisterDevice,
} from "@/services/notifications";
import { ApiError } from "@/services/api";

describe("notifications service", () => {
  beforeEach(async () => {
    mockPermissionState.value = "undetermined";
    mockTokenState.value = "ExponentPushToken[abc-123]";
    mockTokenState.throwOnce = false;
    mockScheduledStore.splice(0, mockScheduledStore.length);
    mockIdentifierCounter.value = 0;
    mockApiPostError.error = null;
    mockApiPostCalls.splice(0, mockApiPostCalls.length);
    await __testing.reset();
  });

  it("requests permissions and reports the granted status", async () => {
    mockPermissionState.value = "granted";
    const status = await requestPermissions();
    expect(status).toBe("granted");
  });

  it("returns 'denied' when the OS rejects the prompt", async () => {
    mockPermissionState.value = "denied";
    const status = await requestPermissions();
    expect(status).toBe("denied");
  });

  it("registers device + persists token + syncs to backend", async () => {
    mockPermissionState.value = "granted";
    const result = await registerForPushNotifications();
    expect(result.permission).toBe("granted");
    expect(result.device?.token).toBe("ExponentPushToken[abc-123]");
    expect(result.syncedToBackend).toBe(true);
    expect(mockApiPostCalls).toHaveLength(1);
    expect(mockApiPostCalls[0]?.path).toBe("/notifications/devices");
    expect(mockApiPostCalls[0]?.body).toMatchObject({
      token: "ExponentPushToken[abc-123]",
    });
    const cached = await getRegisteredDevice();
    expect(cached?.token).toBe("ExponentPushToken[abc-123]");
  });

  it("treats backend 404 as a successful sync (endpoint not deployed)", async () => {
    mockPermissionState.value = "granted";
    mockApiPostError.error = new ApiError("not found", 404);
    const result = await registerForPushNotifications();
    expect(result.syncedToBackend).toBe(true);
  });

  it("returns null device when permission is not granted", async () => {
    mockPermissionState.value = "denied";
    const result = await registerForPushNotifications();
    expect(result.device).toBeNull();
    expect(result.syncedToBackend).toBe(false);
    expect(mockApiPostCalls).toHaveLength(0);
  });

  it("returns null device when token resolution fails (e.g. simulator)", async () => {
    mockPermissionState.value = "granted";
    mockTokenState.throwOnce = true;
    const result = await registerForPushNotifications();
    expect(result.device).toBeNull();
    expect(result.syncedToBackend).toBe(false);
  });

  it("clears the persisted device on unregister", async () => {
    mockPermissionState.value = "granted";
    await registerForPushNotifications();
    await unregisterDevice();
    expect(await getRegisteredDevice()).toBeNull();
  });

  it("schedules an assessment reminder for a future date", async () => {
    const future = new Date(Date.now() + 60_000);
    const reminder = await scheduleAssessmentReminder({
      childId: "c-1",
      childName: "Ali",
      scheduledFor: future,
      titleTemplate: "Time to play with {name}",
      bodyTemplate: "{name} has a quick speech check waiting.",
    });
    expect(reminder).not.toBeNull();
    expect(reminder?.childId).toBe("c-1");
    expect(mockScheduledStore).toHaveLength(1);
    expect(mockScheduledStore[0]?.content.title).toBe("Time to play with Ali");
    expect(mockScheduledStore[0]?.content.body).toBe(
      "Ali has a quick speech check waiting.",
    );
    const listed = await listScheduledReminders();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.childId).toBe("c-1");
  });

  it("refuses to schedule a reminder in the past", async () => {
    const past = new Date(Date.now() - 60_000);
    const reminder = await scheduleAssessmentReminder({
      childId: "c-1",
      childName: "Ali",
      scheduledFor: past,
      titleTemplate: "x",
      bodyTemplate: "y",
    });
    expect(reminder).toBeNull();
    expect(mockScheduledStore).toHaveLength(0);
  });

  it("cancels a scheduled reminder by identifier", async () => {
    const future = new Date(Date.now() + 30_000);
    const reminder = await scheduleAssessmentReminder({
      childId: "c-2",
      childName: "Aziza",
      scheduledFor: future,
      titleTemplate: "{name}",
      bodyTemplate: "{name}",
    });
    if (!reminder) throw new Error("expected reminder to be scheduled");
    await cancelReminder(reminder.identifier);
    expect(mockScheduledStore).toHaveLength(0);
  });

  it("cancels all scheduled reminders", async () => {
    const future = new Date(Date.now() + 60_000);
    await scheduleAssessmentReminder({
      childId: "c-1",
      childName: "A",
      scheduledFor: future,
      titleTemplate: "t",
      bodyTemplate: "b",
    });
    await scheduleAssessmentReminder({
      childId: "c-2",
      childName: "B",
      scheduledFor: future,
      titleTemplate: "t",
      bodyTemplate: "b",
    });
    expect(mockScheduledStore).toHaveLength(2);
    await cancelAllReminders();
    expect(mockScheduledStore).toHaveLength(0);
  });
});
