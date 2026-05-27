/**
 * Unit tests for the auth-tokens helpers. These cover the storage
 * round-trip plus the expiry skew used to decide whether the access
 * token still has enough lifetime to skip a refresh.
 */

import { describe, expect, it, vi } from "vitest";

import {
  clearTokens,
  isAccessExpired,
  readTokens,
  writeTokens,
} from "@/lib/auth-tokens";

describe("auth-tokens", () => {
  it("writeTokens persists and readTokens recovers them", () => {
    const stored = writeTokens({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      expiresIn: 900, // 15 minutes
    });
    expect(stored.accessToken).toBe("access-1");
    expect(stored.refreshToken).toBe("refresh-1");
    expect(stored.expiresAt).toBeGreaterThan(Date.now());

    const recovered = readTokens();
    expect(recovered).not.toBeNull();
    expect(recovered?.accessToken).toBe("access-1");
    expect(recovered?.refreshToken).toBe("refresh-1");
  });

  it("clearTokens removes all keys so readTokens returns null", () => {
    writeTokens({
      accessToken: "a",
      refreshToken: "b",
      expiresIn: 60,
    });
    expect(readTokens()).not.toBeNull();
    clearTokens();
    expect(readTokens()).toBeNull();
  });

  it("isAccessExpired honours the 30s skew", () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    expect(
      isAccessExpired({
        accessToken: "x",
        refreshToken: "y",
        expiresAt: now + 60_000,
      }),
    ).toBe(false);
    expect(
      isAccessExpired({
        accessToken: "x",
        refreshToken: "y",
        expiresAt: now + 5_000, // within skew window
      }),
    ).toBe(true);
    expect(isAccessExpired(null)).toBe(true);
  });

  it("readTokens returns null if expiry value is corrupt", () => {
    window.localStorage.setItem("sado.admin.accessToken", "a");
    window.localStorage.setItem("sado.admin.refreshToken", "b");
    window.localStorage.setItem("sado.admin.accessExpiresAt", "not-a-number");
    expect(readTokens()).toBeNull();
  });
});
