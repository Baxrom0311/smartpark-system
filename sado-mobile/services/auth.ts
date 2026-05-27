/**
 * Auth service — thin wrapper around the API client that handles
 * persistence of tokens after login/register and clears them on logout.
 *
 * Components should call into the auth store (`useAuthStore`) which in
 * turn delegates to these helpers; this keeps the UI free of token
 * bookkeeping.
 */

import { apiClient } from "@/services/api";
import {
  clearTokens,
  readTokens,
  writeTokens,
} from "@/services/token-storage";
import type {
  LoginRequest,
  RegisterRequest,
  TokenPair,
  UserPublic,
} from "@/types";

export interface LoginResult {
  user: UserPublic;
  tokens: TokenPair;
}

async function persist(tokens: TokenPair): Promise<void> {
  await writeTokens({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
  });
}

export async function login(payload: LoginRequest): Promise<LoginResult> {
  const tokens = await apiClient.post<TokenPair>("/auth/login", payload, {
    anonymous: true,
  });
  await persist(tokens);
  // Now that tokens are stored, fetch the current user.
  const user = await apiClient.get<UserPublic>("/users/me");
  return { user, tokens };
}

export async function register(payload: RegisterRequest): Promise<UserPublic> {
  return apiClient.post<UserPublic>("/auth/register", payload, {
    anonymous: true,
  });
}

export async function logout(): Promise<void> {
  const stored = await readTokens();
  if (stored) {
    try {
      await apiClient.post(
        "/auth/logout",
        { refresh_token: stored.refreshToken },
        { anonymous: false },
      );
    } catch {
      // Logout is best-effort: even if the API call fails, we still
      // wipe local tokens so the user is logged out on this device.
    }
  }
  await clearTokens();
}

export async function fetchCurrentUser(): Promise<UserPublic> {
  return apiClient.get<UserPublic>("/users/me");
}

export async function hasStoredSession(): Promise<boolean> {
  const tokens = await readTokens();
  return tokens !== null;
}
