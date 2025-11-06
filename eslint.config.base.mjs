/**
 * Base ESLint configuration for the Arc monorepo
 * Enforces code style standards across all packages
 */

export default {
  rules: {
    // Enforce maximum 500 lines per file
    // This promotes modularity and maintainability
    "max-lines": [
      "error",
      {
        max: 500,
        skipBlankLines: true,
        skipComments: true,
      },
    ],
  },
};
