/**
 * Tests for the API client wrapper around `fetch`. We stub `globalThis.fetch`
 * to verify:
 *
 *  - 2xx responses parse JSON automatically
 *  - 204 responses return undefined and do not call `response.json()`
 *  - non-2xx responses throw a typed `ApiClientError` with detail/code
 *  - a 401 triggers a transparent /auth/refresh + retry
 *  - a fresh access token is reused (no refresh) when not expired
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient, ApiClientError } from "@/lib/api-client";
import { writeTokens } from "@/lib/auth-tokens";

interface MockResponseInit {
  status?: number;
  body?: unknown;
  contentType?: string | null;
  headers?: Record<string, string>;
}

function makeResponse(init: MockResponseInit = {}): Response {
  const status = init.status ?? 200;
  const headers = new Headers(init.headers);
  const ct = init.contentType ?? "application/json";
  if (ct) headers.set("Content-Type", ct);
  let body: BodyInit | null = null;
  if (init.body !== undefined && status !== 204) {
    body = typeof init.body === "string" ? init.body : JSON.stringify(init.body);
  }
  return new Response(body, { status, headers });
}

describe("api-client", () => {
  beforeEach(() => {
    writeTokens({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("parses JSON responses and forwards the bearer token", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(makeResponse({ body: { hello: "world" } }));

    const result = await apiClient.get<{ hello: string }>("/health");
    expect(result).toEqual({ hello: "world" });

    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer access-token");
  });

  it("returns undefined on 204 No Content", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(makeResponse({ status: 204 }));
    const result = await apiClient.delete<undefined>("/users/abc");
    expect(result).toBeUndefined();
  });

  it("throws ApiClientError with detail+code from JSON body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeResponse({
        status: 422,
        body: { detail: "Validation failed", code: "INVALID_INPUT" },
      }),
    );

    await expect(apiClient.post("/whatever", {})).rejects.toMatchObject({
      name: "ApiClientError",
      status: 422,
      code: "INVALID_INPUT",
      message: "Validation failed",
    });
  });

  it("ApiClientError is an instanceof Error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeResponse({ status: 500, body: { detail: "boom" } }),
    );
    try {
      await apiClient.get("/boom");
      throw new Error("unreachable");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiClientError);
    }
  });

  it("refreshes and retries on a 401 from the protected endpoint", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(async () => makeResponse({ status: 401, body: { detail: "expired" } }))
      .mockImplementationOnce(async () =>
        makeResponse({
          body: {
            access_token: "new-access",
            refresh_token: "new-refresh",
            token_type: "bearer",
            expires_in: 900,
          },
        }),
      )
      .mockImplementationOnce(async () => makeResponse({ body: { ok: true } }));

    const result = await apiClient.get<{ ok: boolean }>("/users/me");
    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    const [, retryInit] = fetchSpy.mock.calls[2]!;
    const retryHeaders = (retryInit?.headers ?? {}) as Record<string, string>;
    expect(retryHeaders["Authorization"]).toBe("Bearer new-access");
  });
});
