// Shared ESLint flat-config fragment reused by the root config.
// Each app/package composes this with its own overrides (e.g. React rules for the web app).
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export const baseConfig = tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/consistent-type-imports": "warn",
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
});

export const ignores = {
  ignores: [
    "**/dist/**",
    "**/build/**",
    "**/node_modules/**",
    "**/.vite/**",
    "**/coverage/**",
    "**/generated/**",
  ],
};
