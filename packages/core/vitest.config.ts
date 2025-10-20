import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 60000, // 60 seconds for streaming tests (regenerate runs 2x streams)
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
