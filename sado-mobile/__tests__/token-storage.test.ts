/**
 * Jest setup — smoke tests for the token-storage abstraction.
 *
 * We mock expo-secure-store so the tests can run on a Node runtime
 * without touching the actual platform keychain.
 */

import { Platform } from "react-native";

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

import {
  clearTokens,
  isAccessExpired,
  readTokens,
  writeTokens,
} from "@/services/token-storage";

describe("token-storage", () => {
  beforeEach(async () => {
    await clearTokens();
  });

  it("writes, reads, and clears tokens on iOS", async () => {
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });
    const stored = await writeTokens({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      expiresIn: 900,
    });

    expect(stored.accessToken).toBe("access-1");
    expect(stored.refreshToken).toBe("refresh-1");
    expect(stored.expiresAt).toBeGreaterThan(Date.now());

    const round = await readTokens();
    expect(round?.accessToken).toBe("access-1");

    await clearTokens();
    const cleared = await readTokens();
    expect(cleared).toBeNull();
  });

  it("reports expired tokens correctly", () => {
    expect(isAccessExpired(null)).toBe(true);
    expect(
      isAccessExpired({
        accessToken: "x",
        refreshToken: "y",
        expiresAt: Date.now() - 1,
      }),
    ).toBe(true);
    expect(
      isAccessExpired({
        accessToken: "x",
        refreshToken: "y",
        expiresAt: Date.now() + 5 * 60 * 1000,
      }),
    ).toBe(false);
  });
});
