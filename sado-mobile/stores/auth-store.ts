/**
 * Zustand store holding the authenticated user and a small status
 * machine so screens can branch on `idle | loading | authenticated |
 * unauthenticated | error`.
 *
 * The store deliberately does not persist anything itself — token
 * storage is handled by `services/token-storage` (expo-secure-store).
 * On app launch, `bootstrap()` is called from the root layout to
 * rehydrate the user from the API using the stored refresh token.
 */

import { create } from "zustand";

import {
  fetchCurrentUser,
  hasStoredSession,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from "@/services/auth";
import type {
  LoginRequest,
  RegisterRequest,
  UserPublic,
} from "@/types";

export type AuthStatus =
  | "idle"
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "error";

interface AuthState {
  status: AuthStatus;
  user: UserPublic | null;
  error: string | null;

  bootstrap: () => Promise<void>;
  login: (payload: LoginRequest) => Promise<UserPublic>;
  register: (payload: RegisterRequest) => Promise<UserPublic>;
  logout: () => Promise<void>;
  setUser: (user: UserPublic | null) => void;
  reset: () => void;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "idle",
  user: null,
  error: null,

  bootstrap: async () => {
    if (get().status === "loading") return;
    set({ status: "loading", error: null });
    try {
      const hasSession = await hasStoredSession();
      if (!hasSession) {
        set({ status: "unauthenticated", user: null });
        return;
      }
      const user = await fetchCurrentUser();
      set({ status: "authenticated", user, error: null });
    } catch (error) {
      set({
        status: "unauthenticated",
        user: null,
        error: readErrorMessage(error),
      });
    }
  },

  login: async (payload) => {
    set({ status: "loading", error: null });
    try {
      const result = await loginRequest(payload);
      set({ status: "authenticated", user: result.user, error: null });
      return result.user;
    } catch (error) {
      const message = readErrorMessage(error);
      set({ status: "error", error: message });
      throw error;
    }
  },

  register: async (payload) => {
    set({ status: "loading", error: null });
    try {
      const user = await registerRequest(payload);
      // Registration does NOT auto-login; UI navigates to /login next.
      set({ status: "unauthenticated", user: null, error: null });
      return user;
    } catch (error) {
      const message = readErrorMessage(error);
      set({ status: "error", error: message });
      throw error;
    }
  },

  logout: async () => {
    await logoutRequest();
    set({ status: "unauthenticated", user: null, error: null });
  },

  setUser: (user) =>
    set({
      user,
      status: user ? "authenticated" : "unauthenticated",
    }),

  reset: () => set({ status: "idle", user: null, error: null }),
}));

export const selectIsAuthenticated = (state: AuthState): boolean =>
  state.status === "authenticated" && state.user !== null;
