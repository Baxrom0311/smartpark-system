import { defineConfig } from "vitest/config";
import path from "node:path";
import react from "@vitejs/plugin-react";

/**
 * Vitest configuration. Kept separate from `vite.config.ts` so that
 * route generation / Tailwind plugins don't run for unit tests — those
 * plugins read the filesystem and slow down the test runner.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    css: false,
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/routeTree.gen.ts",
        "src/main.tsx",
        "src/i18n/**",
      ],
    },
  },
});
