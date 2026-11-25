import { defineConfig } from "@playwright/test";

/**
 * End-to-end smoke tests: the production web build against the real API and a real, seeded
 * database — no mocks. They need Postgres with the schema migrated and the dev seed applied; see
 * e2e/README.md. (Screens and accessibility are covered by playwright.config.ts.)
 */
const API_PORT = 4100;
const WEB_PORT = 4174;
const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://dailyloop_test:dailyloop_test_password@localhost:5433/dailyloop_test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  // One shared database: run the journeys one after another.
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: WEB_ORIGIN,
    timezoneId: "UTC",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { viewport: { width: 1280, height: 800 } } }],
  webServer: [
    {
      // The API as deployed (`npm start`), in development mode so rate limits stay on.
      command: "npm run start -w @dailyloop/api",
      cwd: "../..",
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: "development",
        PORT: String(API_PORT),
        DATABASE_URL,
        CORS_ORIGIN: WEB_ORIGIN,
        WEB_APP_URL: WEB_ORIGIN,
        APP_SECRET: "e2e-only-secret-0000000000000000000000",
      },
    },
    {
      // A production build pointed at that API, kept apart from the visual tests' dist/.
      command: `npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port ${WEB_PORT} --strictPort`,
      url: WEB_ORIGIN,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_API_URL: `http://localhost:${API_PORT}/api` },
    },
  ],
});
