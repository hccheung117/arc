import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importX from "eslint-plugin-import-x";
import baseConfig from "../../eslint.config.base.mjs";

const eslintConfig = defineConfig([
  baseConfig,
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    plugins: {
      "import-x": importX,
    },
    rules: {
      // Enforce absolute imports with @/ prefix, allow only same-folder ./ imports
      "import-x/no-relative-parent-imports": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*"],
              message:
                "Parent directory imports are forbidden. Use absolute imports with @/ prefix instead.",
            },
          ],
        },
      ],
      // Prevent barrel files - no re-exporting from other modules
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportAllDeclaration",
          message:
            "Barrel files are forbidden. Export * from statements slow down builds and violate single source of truth.",
        },
        {
          selector:
            "ExportNamedDeclaration[source.value]:not([declaration])",
          message:
            "Barrel files are forbidden. Re-exporting from other modules is not allowed. Import directly from source modules.",
        },
      ],
    },
  },
  // Allow relative imports in config files
  {
    files: ["*.config.{js,mjs,cjs,ts,mts,cts}"],
    rules: {
      "import-x/no-relative-parent-imports": "off",
      "no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;
