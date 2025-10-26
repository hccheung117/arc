import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";
import onlyWarn from "eslint-plugin-only-warn";
import vitest from "eslint-plugin-vitest";
import unicorn from "eslint-plugin-unicorn";
import dirnames from "eslint-plugin-dirnames";

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
      dirnames,
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

      // Ban export-all re-exports (barrel pattern)
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportAllDeclaration",
          message: "Barrel or re-export-all is forbidden. Import directly from source files.",
        },
      ],

      // Enforce kebab-case directory names
      "dirnames/match-kebab-case": "error",
    },
  },

  // Layer boundary enforcement: Platform (lowest layer)
  {
    files: ["packages/platform/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@arc/core", "@arc/core/*"], message: "Platform must not import from @arc/core." },
            { group: ["@arc/ai", "@arc/ai/*"], message: "Platform must not import from @arc/ai." },
            { group: ["@arc/db", "@arc/db/*"], message: "Platform must not import from @arc/db." },
            { group: ["apps/*"], message: "Platform must not import from apps/*." },
          ],
        },
      ],
    },
  },

  // Layer boundary enforcement: AI (module layer)
  {
    files: ["packages/ai/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@arc/core", "@arc/core/*"], message: "AI must not import from @arc/core." },
            { group: ["apps/*"], message: "AI must not import from apps/*." },
          ],
        },
      ],
    },
  },

  // Layer boundary enforcement: DB (module layer)
  {
    files: ["packages/db/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@arc/core", "@arc/core/*"], message: "DB must not import from @arc/core." },
            { group: ["apps/*"], message: "DB must not import from apps/*." },
          ],
        },
      ],
    },
  },

  // Layer boundary enforcement: Core (middle layer)
  {
    files: ["packages/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["apps/*"], message: "Core must not import from apps/*." },
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
