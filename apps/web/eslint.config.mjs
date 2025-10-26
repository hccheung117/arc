import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // Prevent UI layer from importing lower-level packages
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@arc/ai", "@arc/ai/*"],
              message: "UI layer should not import from @arc/ai. Use @arc/core instead.",
            },
            {
              group: ["@arc/db", "@arc/db/*"],
              message: "UI layer should not import from @arc/db. Use @arc/core instead.",
            },
            {
              group: ["@arc/platform", "@arc/platform/*"],
              message: "UI layer should not import from @arc/platform. Use @arc/core instead.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
