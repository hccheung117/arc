import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";
import onlyWarn from "eslint-plugin-only-warn";
import vitest from "eslint-plugin-vitest";
import unicorn from "eslint-plugin-unicorn";

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

  // Architectural enforcement rules
  {
    plugins: {
      unicorn,
    },
    rules: {
      // VIOLATION 5: Enforce kebab-case filenames
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase",
          ignore: [
            // Allow Next.js specific files
            "^layout\\.tsx?$",
            "^page\\.tsx?$",
            "^loading\\.tsx?$",
            "^error\\.tsx?$",
            "^not-found\\.tsx?$",
            "^route\\.ts$",
            "^middleware\\.ts$",
            "^instrumentation\\.ts$",
            // Allow common config files
            "^\\..*rc\\.m?js$",
            "^.*\\.config\\.(m?js|ts)$",
            // Allow README and LICENSE
            "^README\\.md$",
            "^LICENSE$",
            "^CLAUDE\\.md$",
          ],
        },
      ],

      // VIOLATION 6: Ban barrel imports (index files)
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["*/index", "*/index.js", "*/index.ts", "**/index"],
              message:
                "Barrel imports are forbidden. Import directly from source files (e.g., './module.js' not './index.js').",
            },
          ],
        },
      ],
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
