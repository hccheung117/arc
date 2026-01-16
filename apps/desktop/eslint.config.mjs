import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import { importX } from "eslint-plugin-import-x";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".vite/**",
      "src/.vite/**",
      "out/**",
      "dist/**",
      "*.config.ts",
      "*.config.mjs",
      "*.config.js",
      "vite.*.config.ts",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    settings: {
      "import-x/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
      },
      "import-x/core-modules": ["electron"],
    },
    rules: {
      // Custom rules
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*"],
              message:
                "Parent imports (../) are banned. Use aliases (@renderer/, @main/, @arc-types/) instead.",
            },
            {
              group: ["@/*"],
              message:
                "The @/ alias is deprecated. Use @renderer/ for renderer code.",
            },
            {
              group: ["**/index", "**/index.ts", "**/index.tsx"],
              message:
                "Barrel files are forbidden. Import directly from the defining module.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*"],
              message:
                "Parent imports (../) are banned. Use @renderer/ or @arc-types/ instead.",
            },
            {
              group: ["@/*"],
              message:
                "The @/ alias is deprecated. Use @renderer/ for renderer code.",
            },
            {
              group: ["**/index", "**/index.ts", "**/index.tsx"],
              message:
                "Barrel files are forbidden. Import directly from the defining module.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  }
);
