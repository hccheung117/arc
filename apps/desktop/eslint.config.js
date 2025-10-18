import baseConfig from "../../eslint.config.mjs";
import globals from "globals";

export default [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    ignores: ["node_modules/**", "dist/**", "build/**"],
  },
];
