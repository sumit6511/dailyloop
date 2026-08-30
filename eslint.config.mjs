import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { baseConfig, ignores } from "./packages/config/eslint.base.mjs";

export default [
  ignores,
  ...baseConfig,
  {
    files: ["apps/api/**/*.ts", "prisma/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // CLI script — plain console output is the point, not a stray debug log.
    files: ["prisma/seed.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
];
