import { defineConfig } from "@playwright/test";

/**
 * Visual regression tests: screenshots of each screen, compared with the committed baselines in
 * visual/__screenshots__. The API is replayed from recorded fixtures and the clock is frozen, so
 * nothing but the UI itself can change a picture. See visual/README.md.
 */
const PORT = 4173;

export default defineConfig({
  testDir: "./visual",
  testMatch: "**/*.visual.ts",
  snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: "UTC",
    locale: "en-GB",
    trace: "off",
    launchOptions: {
      // Deterministic rendering. Chromium's threaded GPU raster draws the same frame slightly
      // differently from load to load, and font hinting can shift a text run by 1/64 px — enough
      // to move a centred button's edge onto the next pixel. Software raster on one thread with
      // hinting off renders identically every time.
      args: [
        "--disable-gpu",
        "--disable-gpu-rasterization",
        "--num-raster-threads=1",
        "--font-render-hinting=none",
      ],
    },
  },
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      // No pixel may change beyond the per-pixel tolerance: a 4px corner-radius change on the
      // buttons only moves ~5–60 pixels a screen, so any "allowed count" would hide it. The
      // tolerance (0.35 vs Playwright's 0.2) absorbs sub-pixel text jitter at glyph edges; a
      // shape or layout change recolours pixels outright and is still caught. Near-identical
      // shades (one Tailwind step on small text) are below what pixel comparison can see at all.
      maxDiffPixels: 0,
      threshold: 0.35,
    },
  },
  projects: [
    { name: "desktop-dark", use: { viewport: { width: 1280, height: 800 }, colorScheme: "dark" } },
    {
      name: "desktop-light",
      use: { viewport: { width: 1280, height: 800 }, colorScheme: "light" },
    },
    {
      name: "phone-dark",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        colorScheme: "dark",
      },
    },
    {
      name: "phone-light",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        colorScheme: "light",
      },
    },
  ],
  webServer: {
    // The production build, served with the production security headers.
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
