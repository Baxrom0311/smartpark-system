/**
 * Push notifications service — wraps `expo-notifications` so the rest
 * of the app talks to a small, dependency-free surface.
 *
 * Responsibilities:
 *   1. Configure the foreground notification handler so banners are
 *      shown even when the app is open (parents tend to leave the app
 *      foregrounded while their child plays a game).
 *   2. Request OS permission with a UI-friendly result enum so the
 *      caller can branch on "granted" / "denied" / "undetermined".
 *   3. Resolve the Expo push token (only on physical devices — the
 *      simulator returns an error which we translate into `null`).
 *   4. Persist the token locally to avoid duplicate registrations and
 *      sync it to the backend via `apiClient`. The backend may not
 *      expose `/notifications/devices` yet — a 404 is treated as a
 *      no-op so the mobile app keeps working in mock environments.
 *   5. Schedule local reminders for upcoming assessments. We use
 *      `scheduleNotificationAsync` with a date trigger so the OS
 *      handles delivery while the app is closed.
 *
 * The module is intentionally thin: every external dependency is
 * dynamically importable so the jest test can mock them with
 * `jest.mock` without dragging native code into the bundle.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { ApiError, apiClient } from "@/services/api";

const TOKEN_STORAGE_KEY = "sado.mobile.pushToken.v1";
const ANDROID_CHANNEL_ID = "sado.default";
const ANDROID_REMINDER_CHANNEL_ID = "sado.reminders";

export type PermissionStatus = "granted" | "denied" | "undetermined";

export interface RegisteredDevice {
  token: string;
  platform: "ios" | "android" | "web" | "unknown";
  registeredAt: number;
}

export interface ScheduledReminder {
  identifier: string;
  childId: string;
  scheduledFor: string;
}

interface PersistedRegistration extends RegisteredDevice {
  syncedAt: number | null;
}

let handlerConfigured = false;

/**
 * Configure how notifications behave when the app is in the
 * foreground. Idempotent — safe to call from multiple hooks.
 */
export function configureForegroundHandler(): void {
  if (handlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  handlerConfigured = true;
}

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "SADO",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync(ANDROID_REMINDER_CHANNEL_ID, {
    name: "Assessment reminders",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Ask the OS for notification permission. Returns the resulting
 * status mapped to a stable enum. Idempotent — if the user already
 * granted permission, the call is a no-op.
 */
export async function requestPermissions(): Promise<PermissionStatus> {
  await ensureAndroidChannels();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return "granted";
  if (current.canAskAgain === false) {
    return current.status === "undetermined" ? "undetermined" : "denied";
  }
  const next = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
      provideAppNotificationSettings: true,
    },
  });
  if (next.granted) return "granted";
  if (next.status === "undetermined") return "undetermined";
  return "denied";
}

function resolveProjectId(): string | null {
  const fromEas =
    (Constants.expoConfig?.extra?.["eas"] as
      | { projectId?: string }
      | undefined)?.projectId ?? null;
  const fromEasConfig =
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId ??
    null;
  return fromEas ?? fromEasConfig ?? null;
}

function devicePlatform(): RegisteredDevice["platform"] {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  if (Platform.OS === "web") return "web";
  return "unknown";
}

/**
 * Resolve the Expo push token for this device. Returns `null` on
 * platforms that cannot register (web, simulators without project
 * config) so callers don't have to guard against errors.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  // `Device.isDevice` would be ideal but pulling in `expo-device`
  // just for a boolean doubles the native footprint. Instead we
  // catch the well-known simulator error from getExpoPushToken.
  const projectId = resolveProjectId();
  try {
    const result = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return typeof result.data === "string" && result.data.length > 0
      ? result.data
      : null;
  } catch (error) {
    // Simulator / missing entitlements / no network at first launch.
    // We intentionally swallow the failure: notifications are a
    // progressive-enhancement and should never block the UI.
    if (__DEV__) {
      console.warn("[notifications] getExpoPushTokenAsync failed", error);
    }
    return null;
  }
}

async function readPersisted(): Promise<PersistedRegistration | null> {
  const raw = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedRegistration;
    if (typeof parsed.token !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writePersisted(value: PersistedRegistration): Promise<void> {
  await AsyncStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(value));
}

async function clearPersisted(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
}

interface SyncOptions {
  /** Skip the API call — used by tests and offline flows. */
  skipRemote?: boolean;
  /** Override the API endpoint (defaults to /notifications/devices). */
  endpoint?: string;
}

/**
 * Send the push token to the backend. If the endpoint does not exist
 * yet (404) we treat the call as successful so the mobile app keeps
 * working with the in-progress backend.
 */
export async function syncTokenWithBackend(
  token: string,
  platform: RegisteredDevice["platform"],
  options: SyncOptions = {},
): Promise<boolean> {
  if (options.skipRemote) return true;
  const endpoint = options.endpoint ?? "/notifications/devices";
  try {
    await apiClient.post(endpoint, {
      token,
      platform,
      app_version: Constants.expoConfig?.version ?? null,
    });
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      // Endpoint not deployed yet — silent success so the rest of the
      // notification flow remains functional in mock backends.
      return true;
    }
    if (__DEV__) {
      console.warn("[notifications] token sync failed", error);
    }
    return false;
  }
}

export interface RegisterResult {
  permission: PermissionStatus;
  device: RegisteredDevice | null;
  syncedToBackend: boolean;
}

/**
 * Top-level registration flow. Suitable for invocation immediately
 * after the user authenticates. Returns a structured result so the
 * caller can render UI feedback if needed.
 */
export async function registerForPushNotifications(
  options: SyncOptions = {},
): Promise<RegisterResult> {
  configureForegroundHandler();
  const permission = await requestPermissions();
  if (permission !== "granted") {
    return { permission, device: null, syncedToBackend: false };
  }

  const token = await getExpoPushToken();
  if (!token) {
    return { permission, device: null, syncedToBackend: false };
  }

  const platform = devicePlatform();
  const device: RegisteredDevice = {
    token,
    platform,
    registeredAt: Date.now(),
  };

  const previous = await readPersisted();
  const tokenChanged = previous?.token !== token;
  const stale =
    previous?.syncedAt === null ||
    (previous?.syncedAt !== undefined &&
      Date.now() - previous.syncedAt > 7 * 24 * 60 * 60 * 1000);

  let syncedToBackend = previous?.syncedAt !== null && !tokenChanged;
  if (tokenChanged || stale || !syncedToBackend) {
    syncedToBackend = await syncTokenWithBackend(token, platform, options);
  }

  await writePersisted({
    ...device,
    syncedAt: syncedToBackend ? Date.now() : null,
  });

  return { permission, device, syncedToBackend };
}

/** Forget the registered device (e.g. on logout). */
export async function unregisterDevice(): Promise<void> {
  await clearPersisted();
}

/** Read the currently persisted registration without re-running the flow. */
export async function getRegisteredDevice(): Promise<RegisteredDevice | null> {
  const persisted = await readPersisted();
  if (!persisted) return null;
  return {
    token: persisted.token,
    platform: persisted.platform,
    registeredAt: persisted.registeredAt,
  };
}

/* ----------------------------------------------------------------- Reminders */

export interface ScheduleAssessmentReminderInput {
  childId: string;
  childName: string;
  scheduledFor: Date;
  bodyTemplate: string;
  titleTemplate: string;
}

/**
 * Schedule a local notification that fires at `scheduledFor`. The
 * Android channel `sado.reminders` is created lazily in
 * `ensureAndroidChannels()` to keep the function safe to call from
 * any screen.
 */
export async function scheduleAssessmentReminder(
  input: ScheduleAssessmentReminderInput,
): Promise<ScheduledReminder | null> {
  const now = Date.now();
  const triggerMs = input.scheduledFor.getTime();
  if (Number.isNaN(triggerMs) || triggerMs <= now) return null;

  await ensureAndroidChannels();

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: input.titleTemplate.replace("{name}", input.childName),
      body: input.bodyTemplate.replace("{name}", input.childName),
      data: {
        kind: "assessment_reminder",
        childId: input.childId,
      },
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: input.scheduledFor,
      channelId: ANDROID_REMINDER_CHANNEL_ID,
    },
  });

  return {
    identifier,
    childId: input.childId,
    scheduledFor: input.scheduledFor.toISOString(),
  };
}

/** Cancel a previously scheduled reminder by identifier. */
export async function cancelReminder(identifier: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

/** Cancel all currently scheduled local reminders. */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** List currently scheduled local reminders (e.g. for diagnostics). */
export async function listScheduledReminders(): Promise<ScheduledReminder[]> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled
    .filter((entry) => {
      const data = entry.content.data as { kind?: unknown } | null;
      return data?.kind === "assessment_reminder";
    })
    .map((entry) => {
      const data = entry.content.data as
        | { childId?: string; scheduledFor?: string }
        | null;
      return {
        identifier: entry.identifier,
        childId: data?.childId ?? "",
        scheduledFor: data?.scheduledFor ?? "",
      };
    });
}

/* --------------------------------------------------------------- Listeners */

export interface ReceivedNotificationHandlers {
  onReceived?: (notification: Notifications.Notification) => void;
  onResponse?: (response: Notifications.NotificationResponse) => void;
}

/**
 * Wire the notification listeners. Returns a cleanup function that
 * unsubscribes both listeners. Safe to call inside `useEffect`.
 */
export function addNotificationListeners(
  handlers: ReceivedNotificationHandlers,
): () => void {
  const subs: Array<{ remove: () => void }> = [];
  if (handlers.onReceived) {
    subs.push(
      Notifications.addNotificationReceivedListener(handlers.onReceived),
    );
  }
  if (handlers.onResponse) {
    subs.push(
      Notifications.addNotificationResponseReceivedListener(
        handlers.onResponse,
      ),
    );
  }
  return () => {
    for (const sub of subs) {
      sub.remove();
    }
  };
}

export const __testing = {
  reset: async (): Promise<void> => {
    handlerConfigured = false;
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
  },
  ANDROID_CHANNEL_ID,
  ANDROID_REMINDER_CHANNEL_ID,
  TOKEN_STORAGE_KEY,
};
