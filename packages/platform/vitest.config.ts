import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Use happy-dom for browser tests, node for others
    environment: "happy-dom",
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    // Exclude test utilities from test collection
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.d.ts",
      "**/contract-compliance.test.ts", // Helper functions, not actual tests
    ],
  },
});
