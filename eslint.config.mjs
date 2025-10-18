import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";
import onlyWarn from "eslint-plugin-only-warn";
import vitest from "eslint-plugin-vitest";

/**
 * Shared ESLint configuration for the Arc monorepo.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  // Base JavaScript and TypeScript rules
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,

  // Turbo plugin for monorepo
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },

  // Convert all errors to warnings
  {
    plugins: {
      onlyWarn,
    },
  },

  // Vitest rules for test files
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
    },
    languageOptions: {
      globals: {
        ...vitest.environments.env.globals,
      },
    },
  },

  // Ignore patterns
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/build/**",
      "**/coverage/**",
    ],
  },
];
