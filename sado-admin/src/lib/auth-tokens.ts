/**
 * Token storage helpers. Tokens live in `localStorage` so the user
 * stays logged in across reloads, but they're never written to cookies
 * (we don't want them sent automatically to third parties) and the
 * refresh token is rotated on every refresh call.
 */

const ACCESS_KEY = "sado.admin.accessToken";
const REFRESH_KEY = "sado.admin.refreshToken";
const EXPIRES_AT_KEY = "sado.admin.accessExpiresAt";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds at which the access token will expire. */
  expiresAt: number;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readTokens(): StoredTokens | null {
  const storage = getStorage();
  if (!storage) return null;
  const accessToken = storage.getItem(ACCESS_KEY);
  const refreshToken = storage.getItem(REFRESH_KEY);
  const expiresAtRaw = storage.getItem(EXPIRES_AT_KEY);
  if (!accessToken || !refreshToken || !expiresAtRaw) return null;
  const expiresAt = Number.parseInt(expiresAtRaw, 10);
  if (!Number.isFinite(expiresAt)) return null;
  return { accessToken, refreshToken, expiresAt };
}

export function writeTokens(
  tokens: Pick<StoredTokens, "accessToken" | "refreshToken"> & {
    expiresIn: number;
  },
): StoredTokens {
  const storage = getStorage();
  const expiresAt = Date.now() + tokens.expiresIn * 1000;
  if (storage) {
    storage.setItem(ACCESS_KEY, tokens.accessToken);
    storage.setItem(REFRESH_KEY, tokens.refreshToken);
    storage.setItem(EXPIRES_AT_KEY, String(expiresAt));
  }
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt,
  };
}

export function clearTokens(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(ACCESS_KEY);
  storage.removeItem(REFRESH_KEY);
  storage.removeItem(EXPIRES_AT_KEY);
}

/**
 * Returns true if the access token is missing or within `skewMs` of expiry.
 * A 30-second skew avoids racing the wall clock against the API.
 */
export function isAccessExpired(
  tokens: StoredTokens | null,
  skewMs = 30_000,
): boolean {
  if (!tokens) return true;
  return tokens.expiresAt - skewMs <= Date.now();
}
