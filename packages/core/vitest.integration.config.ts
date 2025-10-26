import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/integration/**/*.test.ts"],
    exclude: ["__tests__/__tests__/**", "__tests__/*.test.ts", "node_modules/**"],
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 10000,
  },
});
