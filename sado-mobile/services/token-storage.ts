/**
 * Secure token storage for the SADO mobile app.
 *
 * Tokens are kept in expo-secure-store on device (Keychain on iOS,
 * EncryptedSharedPreferences on Android). On web (jest, expo web) we
 * fall back to AsyncStorage so the app still runs in the test/preview
 * environment, but we never log or expose the raw values.
 *
 * The shape of `StoredTokens` matches what the API client needs to
 * decide whether a refresh is required without parsing the JWT.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const ACCESS_KEY = "sado.mobile.accessToken";
const REFRESH_KEY = "sado.mobile.refreshToken";
const EXPIRES_AT_KEY = "sado.mobile.accessExpiresAt";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds at which the access token expires. */
  expiresAt: number;
}

const useSecureStore = Platform.OS === "ios" || Platform.OS === "android";

async function setItem(key: string, value: string): Promise<void> {
  if (useSecureStore) {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
    return;
  }
  await AsyncStorage.setItem(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (useSecureStore) {
    return SecureStore.getItemAsync(key);
  }
  return AsyncStorage.getItem(key);
}

async function deleteItem(key: string): Promise<void> {
  if (useSecureStore) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}

export async function readTokens(): Promise<StoredTokens | null> {
  const [accessToken, refreshToken, expiresAtRaw] = await Promise.all([
    getItem(ACCESS_KEY),
    getItem(REFRESH_KEY),
    getItem(EXPIRES_AT_KEY),
  ]);
  if (!accessToken || !refreshToken || !expiresAtRaw) return null;
  const expiresAt = Number.parseInt(expiresAtRaw, 10);
  if (!Number.isFinite(expiresAt)) return null;
  return { accessToken, refreshToken, expiresAt };
}

export async function writeTokens(input: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}): Promise<StoredTokens> {
  const expiresAt = Date.now() + input.expiresIn * 1000;
  await Promise.all([
    setItem(ACCESS_KEY, input.accessToken),
    setItem(REFRESH_KEY, input.refreshToken),
    setItem(EXPIRES_AT_KEY, String(expiresAt)),
  ]);
  return {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    expiresAt,
  };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    deleteItem(ACCESS_KEY),
    deleteItem(REFRESH_KEY),
    deleteItem(EXPIRES_AT_KEY),
  ]);
}

/**
 * Returns true if the access token is missing or within `skewMs` of expiry.
 * The 30-second skew avoids racing the wall clock against the API.
 */
export function isAccessExpired(
  tokens: StoredTokens | null,
  skewMs = 30_000,
): boolean {
  if (!tokens) return true;
  return tokens.expiresAt - skewMs <= Date.now();
}
