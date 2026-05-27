/**
 * Typed API client for the SADO backend.
 *
 * Responsibilities:
 *  - Inject the JWT access token on every request
 *  - Transparently refresh expired access tokens via `/auth/refresh`
 *  - Serialize a single in-flight refresh so concurrent 401s only
 *    trigger one `/auth/refresh` call
 *  - Convert non-2xx responses into a typed `ApiClientError`
 *  - Emit a `sado:auth:expired` event when refresh fails so the UI
 *    can redirect to /login
 */

import type { ApiError, TokenPair } from "@/types";
import {
  clearTokens,
  isAccessExpired,
  readTokens,
  writeTokens,
  type StoredTokens,
} from "@/lib/auth-tokens";

const API_BASE = (import.meta.env["VITE_API_BASE_URL"] ?? "/api/v1").replace(
  /\/$/,
  "",
);

export class ApiClientError extends Error {
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
    this.name = "ApiClientError";
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
  /** Skip auth header (e.g. for /auth/login itself). */
  anonymous?: boolean;
  /** Send `body` as multipart instead of JSON. */
  formData?: FormData;
  headers?: Record<string, string>;
}

let refreshInFlight: Promise<StoredTokens | null> | null = null;

function emitAuthExpired(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sado:auth:expired"));
  }
}

async function performRefresh(): Promise<StoredTokens | null> {
  const current = readTokens();
  if (!current) return null;

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: current.refreshToken }),
  });

  if (!response.ok) {
    clearTokens();
    emitAuthExpired();
    return null;
  }

  const pair = (await response.json()) as TokenPair;
  return writeTokens({
    accessToken: pair.access_token,
    refreshToken: pair.refresh_token,
    expiresIn: pair.expires_in,
  });
}

async function ensureFreshTokens(): Promise<StoredTokens | null> {
  const current = readTokens();
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
  const url = new URL(
    `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`,
    typeof window === "undefined"
      ? "http://localhost"
      : window.location.origin,
  );
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  // Return only path + query when API_BASE is relative.
  if (API_BASE.startsWith("http")) return url.toString();
  return `${url.pathname}${url.search}`;
}

async function parseError(response: Response): Promise<ApiClientError> {
  const requestId = response.headers.get("X-Request-ID") ?? undefined;
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = await response.text().catch(() => null);
  }
  const apiPayload = payload as Partial<ApiError> | string | null;
  const message =
    typeof apiPayload === "string"
      ? apiPayload
      : (apiPayload?.detail ?? `HTTP ${response.status}`);
  const code =
    typeof apiPayload === "object" && apiPayload !== null
      ? apiPayload.code
      : undefined;
  return new ApiClientError(message, response.status, code, requestId, payload);
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
    body = options.formData;
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
    // Force a refresh and retry once.
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
