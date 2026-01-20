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
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*"],
              message:
                "Parent imports (../) are banned. Use @renderer/ or @main/ aliases instead.",
            },
            {
              group: ["@/*"],
              message:
                "The @/ alias is deprecated. Use @renderer/ for renderer code.",
            },
            {
              group: ["**/index", "**/index.ts", "**/index.tsx"],
              message:
                "Barrel files are forbidden. Import directly from the source file.",
            },
          ],
        },
      ],
    },
  },
  // Global: 500 lines max — refactor into smaller focused units
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      // TODO: Refactor into smaller components
      "src/renderer/components/ui/sidebar.tsx",
    ],
    rules: {
      "max-lines": [
        "error",
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  // Microkernel: 1000 lines for main — if exceeded, split into multiple modules
  {
    files: ["src/main/**/*.{ts,tsx}"],
    rules: {
      "max-lines": [
        "error",
        { max: 1000, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  // Foundation isolation: cannot import from kernel or modules
  {
    files: ["src/main/foundation/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@main/kernel/*", "@main/kernel"],
              message:
                "Foundation cannot import from kernel. Foundation is the lowest layer — it provides capabilities, not consumes them.",
            },
            {
              group: ["@main/modules/*", "@main/modules"],
              message:
                "Foundation cannot import from modules. Foundation provides capabilities that modules consume via injection.",
            },
          ],
        },
      ],
    },
  },
  // Kernel isolation: cannot import from modules
  {
    files: ["src/main/kernel/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@main/modules/*", "@main/modules"],
              message:
                "Kernel cannot import from modules. Kernel discovers modules via filesystem, not direct imports.",
            },
          ],
        },
      ],
    },
  },
  // Module isolation: cannot import other modules or foundation directly
  {
    files: ["src/main/modules/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@main/modules/*/*"],
              message:
                "Modules cannot import other modules. Declare dependency in mod.ts 'depends' array and receive via kernel injection.",
            },
            {
              group: ["@main/foundation/*", "@main/foundation"],
              message:
                "Modules cannot import foundation directly. Create a capability adapter file (e.g., filesystem.ts) and receive via kernel injection.",
            },
          ],
        },
      ],
    },
  },
  // mod.ts must use 'import type' for adapter imports (type-only, no runtime dependency)
  // Adapters are imported ONLY for type derivation via ReturnType<typeof adapter.factory>
  // Runtime injection is handled by the kernel — mod.ts should never import adapters at runtime
  {
    files: ["src/main/modules/**/mod.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
          disallowTypeAnnotations: false,
        },
      ],
    },
  },
  // types.ts files banned in main — derive types from implementation instead
  {
    files: ["src/main/**/types.ts"],
    rules: {
      "max-lines": ["error", { max: 0 }],
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
