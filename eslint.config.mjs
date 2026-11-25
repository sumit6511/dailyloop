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
    // Playwright tests and scripts: Node, with page.evaluate callbacks running in the browser.
    files: [
      "apps/web/visual/**/*.{ts,mjs}",
      "apps/web/e2e/**/*.ts",
      "apps/web/playwright.e2e.config.ts",
      "apps/web/scripts/**/*.mjs",
      "apps/web/playwright.config.ts",
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    // CLI scripts — their progress output is the point.
    files: ["apps/web/visual/record-fixtures.mjs", "apps/web/scripts/**/*.mjs"],
    rules: {
      "no-console": "off",
    },
  },
  {
    // Plain browser scripts served as-is from public/.
    files: ["apps/web/public/**/*.js"],
    languageOptions: {
      globals: globals.browser,
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
