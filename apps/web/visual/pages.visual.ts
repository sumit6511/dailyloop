import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

/** One recorded API exchange per "METHOD /path?query" (see visual/README.md). */
type Fixture = Record<string, { status: number; body: unknown }>;

const API_ORIGIN = "http://localhost:4000";

function loadFixture(name: string): Fixture {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
}

/** The server's clock when the fixtures were recorded, so "today" and the countdown agree. */
const NOW = new Date(
  (loadFixture("dashboard")["GET /games/schedule"]!.body as { data: { serverTime: string } }).data
    .serverTime,
);

async function replayApi(page: Page, fixture: Fixture) {
  await page.route(`${API_ORIGIN}/api/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname.replace(/^\/api/, "")}${url.search}`;
    const recorded = fixture[key];
    const headers = {
      "access-control-allow-origin": new URL(page.url() || "http://localhost:4173").origin,
      "access-control-allow-credentials": "true",
    };
    if (recorded) return route.fulfill({ status: recorded.status, json: recorded.body, headers });
    // Fire-and-forget writes (heartbeats on leaving a page) don't need a recording.
    if (request.method() !== "GET")
      return route.fulfill({ status: 200, json: { data: {} }, headers });
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: `No fixture for ${key}` } },
      headers,
    });
  });
}

/** Wait until the page has nothing left to load: data, lazy chunks and every web font. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  // document.fonts.ready alone isn't enough: a font file (another weight, or the subset holding
  // a curly apostrophe) can start downloading after it resolves, shifting text by a pixel. Load
  // every declared face up front instead.
  await page.evaluate(async () => {
    await Promise.all(Array.from(document.fonts, (face) => face.load().catch(() => undefined)));
    await document.fonts.ready;
  });
  await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
}

const SCREENS: { name: string; path: string; fixture: string }[] = [
  { name: "login", path: "/login", fixture: "login" },
  { name: "dashboard", path: "/", fixture: "dashboard" },
  { name: "connections", path: "/play/connections", fixture: "connections" },
  { name: "word-guess", path: "/play/word-guess", fixture: "word-guess" },
  { name: "number-puzzle", path: "/play/number-puzzle", fixture: "number-puzzle" },
  { name: "logic-puzzle", path: "/play/logic-puzzle", fixture: "logic-puzzle" },
  { name: "guess-it-result", path: "/play/guess-it", fixture: "guess-it" },
  { name: "pathway", path: "/play/pathway", fixture: "pathway" },
  { name: "friends", path: "/friends", fixture: "friends" },
  { name: "profile", path: "/u/harry", fixture: "profile" },
  { name: "settings", path: "/settings", fixture: "settings" },
  { name: "admin", path: "/admin", fixture: "admin" },
  { name: "admin-puzzles", path: "/admin/puzzles", fixture: "admin-puzzles" },
  { name: "admin-users", path: "/admin/users", fixture: "admin-users" },
  { name: "not-found", path: "/no-such-page", fixture: "settings" },
];

for (const screen of SCREENS) {
  test(screen.name, async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    await replayApi(page, loadFixture(screen.fixture));
    await page.goto(screen.path);
    await settle(page);
    await expect(page).toHaveScreenshot(`${screen.name}.png`, { fullPage: true });
  });
}
