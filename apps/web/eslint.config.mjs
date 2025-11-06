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
      // Enforce absolute imports with @/ prefix, prevent relative imports
      "import-x/no-relative-parent-imports": "error",
    },
  },
  // Allow relative imports in config files
  {
    files: ["*.config.{js,mjs,cjs,ts,mts,cts}"],
    rules: {
      "import-x/no-relative-parent-imports": "off",
    },
  },
]);

export default eslintConfig;
