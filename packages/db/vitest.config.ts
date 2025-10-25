import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Use node environment for database tests
    environment: "node",
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    // Exclude standard directories from test collection
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.d.ts"],
  },
});
