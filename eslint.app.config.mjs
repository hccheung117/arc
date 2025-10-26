/**
 * Shared ESLint configuration for Arc application layer (UI).
 *
 * Enforces architectural boundaries: UI layer must only import from @arc/core,
 * never directly from @arc/ai, @arc/db, or @arc/platform.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  {
    files: ["apps/*/**/*.{ts,tsx}"],
    ignores: ["apps/*/**/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@arc/ai", "@arc/ai/*"],
              message: "UI layer must not import from @arc/ai. Use @arc/core instead.",
            },
            {
              group: ["@arc/db", "@arc/db/*"],
              message: "UI layer must not import from @arc/db. Use @arc/core instead.",
            },
            {
              group: ["@arc/platform", "@arc/platform/*"],
              message: "UI layer must not import from @arc/platform. Use @arc/core instead.",
            },
          ],
        },
      ],
    },
  },
  {
    // Allow tests to import from lower layers for mocking
    files: ["apps/*/**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

