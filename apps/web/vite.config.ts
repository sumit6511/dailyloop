import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
// A relative path (not "@dailyloop/shared") so Vite's config bundler inlines it.
import { ICON_NAMES } from "../../packages/shared/src/icons";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envDir = path.resolve(__dirname, "../../");

/** NODE_ENV as set in the .env files Vite will load for this mode (later files win). */
function nodeEnvFromEnvFiles(mode: string): string | undefined {
  let value: string | undefined;
  for (const name of [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`]) {
    const file = path.join(envDir, name);
    if (fs.existsSync(file)) value = parseEnv(fs.readFileSync(file, "utf8")).NODE_ENV ?? value;
  }
  return value;
}

export default defineConfig(({ command, mode }) => {
  // The repo-root .env is shared with the API. If it sets NODE_ENV to anything but "production",
  // Vite applies it to the build after this config runs, which silently bundles React's
  // development build (~1.7x larger, slower). Fail loudly instead.
  const fromEnvFile = nodeEnvFromEnvFiles(mode);
  if (command === "build" && fromEnvFile && fromEnvFile !== "production") {
    throw new Error(
      `.env sets NODE_ENV=${fromEnvFile}, which would make this production build bundle React's ` +
        "development build. Remove NODE_ENV from .env (the API defaults to development).",
    );
  }
  return config;
});

/** The production security headers, for `vite preview`. connect-src also allows the configured API
 * origin so a local preview against http://localhost:4000 works; production uses https only. */
function previewSecurityHeaders(): Record<string, string> {
  const headers = JSON.parse(
    fs.readFileSync(path.join(__dirname, "security-headers.json"), "utf8"),
  ) as Record<string, string>;
  delete headers["//"];
  let apiOrigin = "http://localhost:4000";
  try {
    apiOrigin = new URL(process.env.VITE_API_URL ?? "http://localhost:4000/api").origin;
  } catch {
    // A bare host (as Render provides) is https anyway, which connect-src already allows.
  }
  headers["Content-Security-Policy"] = headers["Content-Security-Policy"]!.replace(
    "connect-src 'self' https:",
    `connect-src 'self' https: ${apiOrigin}`,
  );
  return headers;
}

/**
 * Requests only the Material Symbols glyphs the app uses (ICON_NAMES): ~120 kB instead of the
 * full 5.4 MB variable font, which also blocks icon rendering (display=block) until it arrives.
 */
function materialSymbolsSubset(): Plugin {
  return {
    name: "dailyloop:material-symbols-subset",
    transformIndexHtml: (html) =>
      html.replace("__MATERIAL_SYMBOLS_ICON_NAMES__", [...ICON_NAMES].sort().join(",")),
  };
}

/**
 * Libraries that change far less often than the app: each gets its own content-hashed chunk, so a
 * deploy that only touches app code leaves them cached in returning visitors' browsers.
 */
const VENDOR_CHUNKS: Record<string, RegExp> = {
  react: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
  data: /[\\/]node_modules[\\/](@tanstack|zod|react-hook-form|@hookform)[\\/]/,
};

const config = {
  plugins: [react(), tailwindcss(), materialSymbolsSubset()],
  build: {
    // Never inline font files as data: URIs (Vite does for anything under 4 kB): the CSP's
    // font-src allows the app's own origin, not data:.
    assetsInlineLimit: (filePath: string) => (/\.woff2?$/.test(filePath) ? false : undefined),
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          for (const [name, pattern] of Object.entries(VENDOR_CHUNKS)) {
            if (pattern.test(id)) return `vendor-${name}`;
          }
          return undefined;
        },
      },
    },
  },
  preview: {
    port: 5173,
    strictPort: true,
    headers: previewSecurityHeaders(),
  },
  // Vite only reads .env files from its own root (this folder) by default;
  // pointing it at the repo root lets every app share one .env file.
  envDir,
  server: {
    port: 5173,
    // Fail loudly if 5173 is taken instead of silently starting on the next free port — a
    // silent fallback here once meant the dev server was actually on 5174 while everyone kept
    // opening 5173 (a different, unrelated project) and hitting confusing, unrelated errors.
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
};
