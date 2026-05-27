/**
 * Tests for the UI store, focused on the theme switcher because it
 * persists to localStorage and toggles a class on `<html>` that
 * Tailwind's dark variants depend on.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyTheme, useUiStore } from "@/stores/ui-store";

describe("ui-store / theme", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
    delete document.documentElement.dataset["theme"];
    window.localStorage.clear();
    useUiStore.setState({ theme: "system", sidebarOpen: true });
  });

  afterEach(() => {
    document.documentElement.classList.remove("dark");
  });

  it("setTheme persists to localStorage and applies the dark class", () => {
    useUiStore.getState().setTheme("dark");
    expect(window.localStorage.getItem("sado.admin.theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.dataset["theme"]).toBe("dark");
  });

  it("setTheme('light') removes the dark class", () => {
    useUiStore.getState().setTheme("dark");
    useUiStore.getState().setTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem("sado.admin.theme")).toBe("light");
  });

  it("applyTheme('system') resolves via prefers-color-scheme", () => {
    applyTheme("system");
    // Our jsdom matchMedia stub returns false for the dark query, so
    // 'system' should resolve to light.
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("toggleSidebar flips the sidebarOpen flag", () => {
    expect(useUiStore.getState().sidebarOpen).toBe(true);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(false);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(true);
  });
});
