/**
 * useNotifications — drives the push notification lifecycle inside
 * the React tree.
 *
 * Responsibilities:
 *   1. Configure the foreground handler once on mount (idempotent).
 *   2. After the user is authenticated, request OS permission and
 *      register the Expo push token with the backend.
 *   3. Subscribe to the notification listeners while the component
 *      is mounted, surfacing the most recent notification + the most
 *      recent tap response so screens can react.
 *
 * The hook is read-only from the perspective of the rest of the app —
 * the auth bootstrap effect calls it and screens that need the
 * permission status (e.g. Settings) read from `usePushPermission`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type * as Notifications from "expo-notifications";

import {
  addNotificationListeners,
  configureForegroundHandler,
  getRegisteredDevice,
  registerForPushNotifications,
  type PermissionStatus,
  type RegisteredDevice,
} from "@/services/notifications";

export interface UseNotificationsOptions {
  /**
   * Only run the registration flow once `enabled` is true. Typical
   * usage: pass `auth.status === "authenticated"` so we don't ask
   * for permission before the user has logged in.
   */
  enabled?: boolean;
}

export interface UseNotificationsResult {
  permission: PermissionStatus | null;
  device: RegisteredDevice | null;
  lastNotification: Notifications.Notification | null;
  lastResponse: Notifications.NotificationResponse | null;
  /** Re-run the registration flow (e.g. after the user grants perms). */
  refresh: () => Promise<void>;
}

export function useNotifications(
  options: UseNotificationsOptions = {},
): UseNotificationsResult {
  const { enabled = true } = options;
  const [permission, setPermission] = useState<PermissionStatus | null>(null);
  const [device, setDevice] = useState<RegisteredDevice | null>(null);
  const [lastNotification, setLastNotification] =
    useState<Notifications.Notification | null>(null);
  const [lastResponse, setLastResponse] =
    useState<Notifications.NotificationResponse | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    const result = await registerForPushNotifications();
    setPermission(result.permission);
    setDevice(result.device);
  }, []);

  useEffect(() => {
    configureForegroundHandler();
    let cancelled = false;
    void (async () => {
      const cached = await getRegisteredDevice();
      if (!cancelled && cached) setDevice(cached);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const result = await registerForPushNotifications();
      if (cancelled) return;
      setPermission(result.permission);
      setDevice(result.device);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    const cleanup = addNotificationListeners({
      onReceived: (n) => setLastNotification(n),
      onResponse: (r) => setLastResponse(r),
    });
    return cleanup;
  }, []);

  return useMemo(
    () => ({
      permission,
      device,
      lastNotification,
      lastResponse,
      refresh,
    }),
    [permission, device, lastNotification, lastResponse, refresh],
  );
}
