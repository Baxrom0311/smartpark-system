/**
 * Typed HTTP client for the SADO backend.
 *
 * Responsibilities mirror the admin client:
 *   - Inject the JWT access token on every request
 *   - Transparently refresh expired access tokens via /auth/refresh
 *   - Serialize a single in-flight refresh so concurrent 401s only
 *     trigger one /auth/refresh call
 *   - Convert non-2xx responses into a typed `ApiError`
 *   - Emit a `sado:auth:expired` event (via DeviceEventEmitter) when
 *     refresh fails so the UI can redirect to the auth flow.
 *
 * The API base URL is read from `expo-constants` extras so it can be
 * overridden per environment without rebuilding the app binary.
 */

import Constants from "expo-constants";
import { DeviceEventEmitter } from "react-native";

import type { ApiErrorPayload, TokenPair } from "@/types";
import {
  clearTokens,
  isAccessExpired,
  readTokens,
  writeTokens,
  type StoredTokens,
} from "@/services/token-storage";

export const AUTH_EXPIRED_EVENT = "sado:auth:expired";

interface ExpoExtra {
  apiBaseUrl?: string;
}

function resolveBaseUrl(): string {
  const expoExtra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
  const fromExpo = expoExtra.apiBaseUrl;
  const base = fromExpo ?? "http://localhost:8000/api/v1";
  return base.replace(/\/$/, "");
}

const API_BASE = resolveBaseUrl();

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string | undefined;
  public readonly requestId: string | undefined;
  public readonly raw: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    requestId?: string,
    raw?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.raw = raw;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Skip Authorization header (e.g. /auth/login). */
  anonymous?: boolean;
  /** Send `body` as multipart instead of JSON. */
  formData?: FormData;
  headers?: Record<string, string>;
}

let refreshInFlight: Promise<StoredTokens | null> | null = null;

function emitAuthExpired(): void {
  DeviceEventEmitter.emit(AUTH_EXPIRED_EVENT);
}

async function performRefresh(): Promise<StoredTokens | null> {
  const current = await readTokens();
  if (!current) return null;

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: current.refreshToken }),
    });

    if (!response.ok) {
      await clearTokens();
      emitAuthExpired();
      return null;
    }

    const pair = (await response.json()) as TokenPair;
    return writeTokens({
      accessToken: pair.access_token,
      refreshToken: pair.refresh_token,
      expiresIn: pair.expires_in,
    });
  } catch {
    // Network failures should not nuke the user's session — surface
    // the failure to the caller and let it retry later.
    return null;
  }
}

async function ensureFreshTokens(): Promise<StoredTokens | null> {
  const current = await readTokens();
  if (!current) return null;
  if (!isAccessExpired(current)) return current;

  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function buildUrl(
  path: string,
  query: RequestOptions["query"] | undefined,
): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const search = query
    ? Object.entries(query)
        .filter(
          (entry): entry is [string, string | number | boolean] =>
            entry[1] !== undefined && entry[1] !== null,
        )
        .map(
          ([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
        )
        .join("&")
    : "";
  return search ? `${API_BASE}${normalized}?${search}` : `${API_BASE}${normalized}`;
}

async function parseError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get("X-Request-ID") ?? undefined;
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = await response.text().catch(() => null);
  }
  const apiPayload = payload as Partial<ApiErrorPayload> | string | null;
  const message =
    typeof apiPayload === "string"
      ? apiPayload
      : (apiPayload?.detail ?? `HTTP ${response.status}`);
  const code =
    typeof apiPayload === "object" && apiPayload !== null
      ? apiPayload.code
      : undefined;
  return new ApiError(message, response.status, code, requestId, payload);
}

async function rawRequest<T>(
  path: string,
  options: RequestOptions,
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  };

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData as unknown as BodyInit;
  } else if (options.body !== undefined) {
    headers["Content-Type"] ??= "application/json";
    body = JSON.stringify(options.body);
  }

  if (!options.anonymous) {
    const tokens = await ensureFreshTokens();
    if (tokens) {
      headers["Authorization"] = `Bearer ${tokens.accessToken}`;
    }
  }

  const url = buildUrl(path, options.query);
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body,
    signal: options.signal,
  });

  if (response.status === 401 && !options.anonymous && retry) {
    refreshInFlight = null;
    const refreshed = await performRefresh();
    if (refreshed) {
      return rawRequest<T>(path, options, false);
    }
    emitAuthExpired();
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return (await response.text()) as unknown as T;
}

export const apiClient = {
  baseUrl: API_BASE,
  request: rawRequest,
  get<T>(path: string, options: Omit<RequestOptions, "method" | "body"> = {}) {
    return rawRequest<T>(path, { ...options, method: "GET" });
  },
  post<T>(path: string, body?: unknown, options: RequestOptions = {}) {
    return rawRequest<T>(path, { ...options, method: "POST", body });
  },
  put<T>(path: string, body?: unknown, options: RequestOptions = {}) {
    return rawRequest<T>(path, { ...options, method: "PUT", body });
  },
  patch<T>(path: string, body?: unknown, options: RequestOptions = {}) {
    return rawRequest<T>(path, { ...options, method: "PATCH", body });
  },
  delete<T>(path: string, options: RequestOptions = {}) {
    return rawRequest<T>(path, { ...options, method: "DELETE" });
  },
};

export type ApiClient = typeof apiClient;
