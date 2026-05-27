/**
 * Hook tests for `useNotifications`.
 *
 * The hook is wired to `services/notifications`, which itself wraps
 * `expo-notifications`. Rather than mocking the whole native module
 * we mock the service surface directly — that's the boundary the
 * hook talks to and lets us drive deterministic registration and
 * listener events.
 *
 * We keep using `react-test-renderer` (already a dependency via
 * jest-expo) so the suite stays consistent with the rest of the
 * mobile tests and avoids pulling `@testing-library/react-native`.
 */

import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockRegisterForPushNotifications = jest.fn();
const mockGetRegisteredDevice = jest.fn();
const mockConfigureForegroundHandler = jest.fn();

interface ListenerHandlers {
  onReceived?: (n: unknown) => void;
  onResponse?: (r: unknown) => void;
}

const mockListenerStore: { current: ListenerHandlers | null } = {
  current: null,
};
const mockListenerCleanup = jest.fn();

jest.mock("@/services/notifications", () => ({
  configureForegroundHandler: (...args: unknown[]) =>
    mockConfigureForegroundHandler(...args),
  registerForPushNotifications: (...args: unknown[]) =>
    mockRegisterForPushNotifications(...args),
  getRegisteredDevice: (...args: unknown[]) =>
    mockGetRegisteredDevice(...args),
  addNotificationListeners: (handlers: ListenerHandlers) => {
    mockListenerStore.current = handlers;
    return mockListenerCleanup;
  },
}));

import { useNotifications, type UseNotificationsResult } from "@/hooks/useNotifications";

interface HarnessProps {
  enabled?: boolean;
  capture: (result: UseNotificationsResult) => void;
}

function Harness({ enabled, capture }: HarnessProps): null {
  const result = useNotifications({ enabled });
  // Capture on every render so the test can inspect the latest value.
  capture(result);
  return null;
}

async function flushAsync(): Promise<void> {
  // Resolve all pending microtasks. The hook chains a few promises
  // (registerForPushNotifications + getRegisteredDevice) so we need
  // multiple ticks before state settles.
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
}

describe("useNotifications", () => {
  beforeEach(() => {
    mockRegisterForPushNotifications.mockReset();
    mockGetRegisteredDevice.mockReset();
    mockConfigureForegroundHandler.mockReset();
    mockListenerCleanup.mockReset();
    mockListenerStore.current = null;
    mockGetRegisteredDevice.mockResolvedValue(null);
    mockRegisterForPushNotifications.mockResolvedValue({
      permission: "granted",
      device: {
        token: "ExponentPushToken[xyz]",
        platform: "ios",
        registeredAt: 1,
      },
      syncedToBackend: true,
    });
  });

  it("configures the foreground handler and registers when enabled", async () => {
    const captures: UseNotificationsResult[] = [];
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      renderer = TestRenderer.create(
        <Harness capture={(r) => captures.push(r)} />,
      );
      await flushAsync();
    });

    expect(mockConfigureForegroundHandler).toHaveBeenCalledTimes(1);
    expect(mockRegisterForPushNotifications).toHaveBeenCalledTimes(1);
    const last = captures[captures.length - 1];
    expect(last?.permission).toBe("granted");
    expect(last?.device?.token).toBe("ExponentPushToken[xyz]");

    await act(async () => {
      renderer!.unmount();
    });
    expect(mockListenerCleanup).toHaveBeenCalledTimes(1);
  });

  it("skips the registration flow when disabled", async () => {
    const captures: UseNotificationsResult[] = [];
    await act(async () => {
      TestRenderer.create(
        <Harness enabled={false} capture={(r) => captures.push(r)} />,
      );
      await flushAsync();
    });

    expect(mockConfigureForegroundHandler).toHaveBeenCalledTimes(1);
    expect(mockRegisterForPushNotifications).not.toHaveBeenCalled();
    const last = captures[captures.length - 1];
    expect(last?.permission).toBeNull();
    expect(last?.device).toBeNull();
  });

  it("hydrates the cached device when the registration is pending", async () => {
    mockGetRegisteredDevice.mockResolvedValue({
      token: "cached-token",
      platform: "android",
      registeredAt: 100,
    });
    // Slow path so the cached value is observed before the live one.
    mockRegisterForPushNotifications.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                permission: "granted",
                device: {
                  token: "live-token",
                  platform: "android",
                  registeredAt: 200,
                },
                syncedToBackend: true,
              }),
            0,
          );
        }),
    );

    const captures: UseNotificationsResult[] = [];
    await act(async () => {
      TestRenderer.create(<Harness capture={(r) => captures.push(r)} />);
      await flushAsync();
      // Drain the deferred resolve.
      await new Promise<void>((r) => setTimeout(r, 1));
      await flushAsync();
    });

    const tokens = captures
      .map((c) => c.device?.token)
      .filter((v): v is string => typeof v === "string");
    expect(tokens).toContain("cached-token");
    expect(tokens[tokens.length - 1]).toBe("live-token");
  });

  it("surfaces the most recent received notification + tap response", async () => {
    const captures: UseNotificationsResult[] = [];
    await act(async () => {
      TestRenderer.create(<Harness capture={(r) => captures.push(r)} />);
      await flushAsync();
    });

    const handlers = mockListenerStore.current;
    expect(handlers).not.toBeNull();

    await act(async () => {
      handlers?.onReceived?.({ request: { identifier: "n-1" } });
      await flushAsync();
    });
    await act(async () => {
      handlers?.onResponse?.({
        notification: { request: { identifier: "n-1" } },
        actionIdentifier: "default",
      });
      await flushAsync();
    });

    const last = captures[captures.length - 1];
    expect(last?.lastNotification).toMatchObject({
      request: { identifier: "n-1" },
    });
    expect(last?.lastResponse).toMatchObject({ actionIdentifier: "default" });
  });

  it("re-runs registration when refresh() is invoked", async () => {
    let captured: UseNotificationsResult | null = null;
    await act(async () => {
      TestRenderer.create(
        <Harness
          capture={(r) => {
            captured = r;
          }}
        />,
      );
      await flushAsync();
    });
    expect(captured).not.toBeNull();
    expect(mockRegisterForPushNotifications).toHaveBeenCalledTimes(1);

    mockRegisterForPushNotifications.mockResolvedValueOnce({
      permission: "granted",
      device: {
        token: "refreshed-token",
        platform: "ios",
        registeredAt: 999,
      },
      syncedToBackend: true,
    });

    await act(async () => {
      // captured is non-null after the initial mount above; the cast
      // unblocks TypeScript's strict null analysis without forcing
      // tests to wrap every read in a guard.
      await (captured as unknown as UseNotificationsResult).refresh();
      await flushAsync();
    });
    expect(mockRegisterForPushNotifications).toHaveBeenCalledTimes(2);
    expect((captured as unknown as UseNotificationsResult).device?.token).toBe(
      "refreshed-token",
    );
  });
});
