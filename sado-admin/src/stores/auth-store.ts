import { create } from "zustand";

import { apiClient } from "@/lib/api-client";
import {
  clearTokens,
  readTokens,
  writeTokens,
  type StoredTokens,
} from "@/lib/auth-tokens";
import type { LoginRequest, TokenPair, UserPublic } from "@/types";

interface AuthState {
  user: UserPublic | null;
  tokens: StoredTokens | null;
  status: "idle" | "loading" | "authenticated" | "anonymous" | "error";
  error: string | null;

  /** Hydrate from localStorage and verify with `/users/me`. */
  bootstrap: () => Promise<void>;
  login: (payload: LoginRequest) => Promise<UserPublic>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  status: "idle",
  error: null,

  bootstrap: async () => {
    const stored = readTokens();
    if (!stored) {
      set({ status: "anonymous", user: null, tokens: null });
      return;
    }
    set({ status: "loading", tokens: stored });
    try {
      const user = await apiClient.get<UserPublic>("/users/me");
      set({ status: "authenticated", user, error: null });
    } catch (err) {
      clearTokens();
      set({
        status: "anonymous",
        user: null,
        tokens: null,
        error: err instanceof Error ? err.message : "Session expired",
      });
    }
  },

  login: async (payload) => {
    set({ status: "loading", error: null });
    try {
      const pair = await apiClient.post<TokenPair>("/auth/login", payload, {
        anonymous: true,
      });
      const tokens = writeTokens({
        accessToken: pair.access_token,
        refreshToken: pair.refresh_token,
        expiresIn: pair.expires_in,
      });
      const user = await apiClient.get<UserPublic>("/users/me");
      set({ status: "authenticated", user, tokens, error: null });
      return user;
    } catch (err) {
      clearTokens();
      const message = err instanceof Error ? err.message : "Login failed";
      set({ status: "error", error: message, user: null, tokens: null });
      throw err;
    }
  },

  logout: async () => {
    const { tokens } = get();
    if (tokens) {
      try {
        await apiClient.post("/auth/logout", {
          refresh_token: tokens.refreshToken,
        });
      } catch {
        // Logout is idempotent — ignore network errors.
      }
    }
    clearTokens();
    set({ status: "anonymous", user: null, tokens: null, error: null });
  },

  refreshUser: async () => {
    try {
      const user = await apiClient.get<UserPublic>("/users/me");
      set({ user });
    } catch {
      // Leave state untouched; the api-client will trigger logout on 401.
    }
  },
}));

// Listen for the api-client's "session expired" event and reset state.
if (typeof window !== "undefined") {
  window.addEventListener("sado:auth:expired", () => {
    useAuthStore.setState({
      status: "anonymous",
      user: null,
      tokens: null,
    });
  });
}
