/**
 * Tests for the Zustand auth store. We mock the api-client surface so the
 * store can be exercised without a real network or test-only fetch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TokenPair, UserPublic } from "@/types";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  ApiClientError: class ApiClientError extends Error {
    public readonly status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

const mockedApi = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const sampleUser: UserPublic = {
  id: "u1",
  email: "admin@sado.uz",
  phone: null,
  full_name: "Admin",
  role: "admin",
  language: "uz",
  is_active: true,
  is_verified: true,
  region_id: null,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const samplePair: TokenPair = {
  access_token: "a1",
  refresh_token: "r1",
  token_type: "bearer",
  expires_in: 900,
};

describe("auth-store", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      tokens: null,
      status: "idle",
      error: null,
    });
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("login stores tokens and switches to authenticated", async () => {
    mockedApi.post.mockResolvedValueOnce(samplePair);
    mockedApi.get.mockResolvedValueOnce(sampleUser);

    const result = await useAuthStore
      .getState()
      .login({ email: "admin@sado.uz", password: "12345678" });

    expect(result).toEqual(sampleUser);

    const state = useAuthStore.getState();
    expect(state.status).toBe("authenticated");
    expect(state.user).toEqual(sampleUser);
    expect(state.tokens?.accessToken).toBe("a1");
  });

  it("login failure resets state and rethrows", async () => {
    mockedApi.post.mockRejectedValueOnce(new Error("nope"));

    await expect(
      useAuthStore
        .getState()
        .login({ email: "x@y.z", password: "wrong-password" }),
    ).rejects.toThrow("nope");

    const state = useAuthStore.getState();
    expect(state.status).toBe("error");
    expect(state.user).toBeNull();
    expect(state.tokens).toBeNull();
  });

  it("logout clears tokens and goes anonymous", async () => {
    mockedApi.post.mockResolvedValueOnce(samplePair);
    mockedApi.get.mockResolvedValueOnce(sampleUser);
    await useAuthStore
      .getState()
      .login({ email: "admin@sado.uz", password: "12345678" });

    mockedApi.post.mockResolvedValueOnce(undefined);
    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.status).toBe("anonymous");
    expect(state.user).toBeNull();
    expect(state.tokens).toBeNull();
    expect(window.localStorage.getItem("sado.admin.accessToken")).toBeNull();
  });

  it("bootstrap with no stored tokens lands on anonymous", async () => {
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe("anonymous");
    expect(mockedApi.get).not.toHaveBeenCalled();
  });
});
