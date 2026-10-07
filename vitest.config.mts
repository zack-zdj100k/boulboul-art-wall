import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: ".env" });

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup-env.ts"],
    fileParallelism: false, // integration tests share one test database
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
