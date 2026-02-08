import eslint from "@eslint/js";
import { importX } from "eslint-plugin-import-x";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      ".vite/**",
      "src/.vite/**",
      "out/**",
      "dist/**",
      "*.config.mjs",
      "*.config.js",
      "vite.*.config.mjs",
    ],
  },
  eslint.configs.recommended,
  importX.flatConfigs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    settings: {
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
              group: ["**/index", "**/index.js", "**/index.jsx"],
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
    files: ["**/*.{js,jsx}"],
    ignores: [
      // TODO: Refactor into smaller components
      "src/renderer/components/ui/sidebar.jsx",
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
    files: ["src/main/**/*.{js,jsx}"],
    rules: {
      "max-lines": [
        "error",
        { max: 1000, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  // Foundation isolation: cannot import from kernel or modules
  {
    files: ["src/main/foundation/**/*.{js,jsx}"],
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
    files: ["src/main/kernel/**/*.{js,jsx}"],
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
    files: ["src/main/modules/**/*.{js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@main/modules/*/*"],
              message:
                "Modules cannot import other modules. Declare dependency in mod.js 'depends' array and receive via kernel injection.",
            },
            {
              group: ["@main/foundation/*", "@main/foundation"],
              message:
                "Modules cannot import foundation directly. Create a capability adapter file (e.g., filesystem.js) and receive via kernel injection.",
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
];
