import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
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
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      import: importPlugin,
    },
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
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
      },
      // Mark electron as external (plugin:import/electron equivalent)
      "import/core-modules": ["electron"],
    },
    rules: {
      // plugin:import/recommended rules
      "import/no-unresolved": "error",
      "import/named": "error",
      "import/default": "error",
      "import/namespace": "error",
      "import/export": "error",
      "import/no-named-as-default": "warn",
      "import/no-named-as-default-member": "warn",
      "import/no-duplicates": "warn",
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
              group: ["@main/*"],
              message:
                "Renderer cannot import main process code. Use IPC via window.arc.",
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
  }
);
