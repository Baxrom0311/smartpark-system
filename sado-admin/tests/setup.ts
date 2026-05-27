/**
 * Vitest global setup — wires up jest-dom matchers, polyfills jsdom
 * gaps, and clears localStorage between tests so stores hydrated from
 * `window.localStorage` always start fresh.
 */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom does not implement `matchMedia`; ui-store reads it on init.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

/**
 * jsdom's `localStorage` implementation in vitest's bundled environment
 * sometimes exposes the *prototype* without methods bound, so the clear()
 * call below would throw `... is not a function`. We install a small
 * in-memory shim that satisfies the Storage interface.
 */
function installStorageShim(target: Window, key: "localStorage" | "sessionStorage"): void {
  const existing = target[key];
  if (existing && typeof existing.clear === "function") return;
  const store = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => {
      store.delete(k);
    },
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
  };
  Object.defineProperty(target, key, { value: shim, writable: true });
}

if (typeof window !== "undefined") {
  installStorageShim(window, "localStorage");
  installStorageShim(window, "sessionStorage");
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
