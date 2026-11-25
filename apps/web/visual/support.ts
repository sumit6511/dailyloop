import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

/** One recorded API exchange per "METHOD /path?query" (see visual/README.md). */
export type Fixture = Record<string, { status: number; body: unknown }>;

const API_ORIGIN = "http://localhost:4000";

export function loadFixture(name: string): Fixture {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
}

/** The server's clock when the fixtures were recorded, so "today" and the countdown agree. */
export const NOW = new Date(
  (loadFixture("dashboard")["GET /games/schedule"]!.body as { data: { serverTime: string } }).data
    .serverTime,
);

export async function replayApi(page: Page, fixture: Fixture) {
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
export async function settle(page: Page) {
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

export interface Screen {
  name: string;
  path: string;
  fixture: string;
  /** Show the page as a first-time player sees it: with the game's rules dialog open. */
  firstVisit?: boolean;
}

const GAME_SLUGS = [
  "connections",
  "word-guess",
  "number-puzzle",
  "logic-puzzle",
  "guess-it",
  "pathway",
];

export const SCREENS: Screen[] = [
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
  { name: "how-to-play", path: "/play/connections", fixture: "connections", firstVisit: true },
];

/** Opens a screen with its recorded API and the frozen clock, ready to inspect. */
export async function openScreen(page: Page, screen: Screen) {
  // The build runs under the production Content-Security-Policy; anything it blocks (an inlined
  // font, a stray inline style) fails the screen rather than silently not loading.
  const blocked: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text())) blocked.push(message.text());
  });
  if (!screen.firstVisit) {
    // A returning player: the rules dialog that opens on a first visit would cover the board.
    await page.addInitScript((slugs) => {
      for (const slug of slugs) localStorage.setItem(`dailyloop-rules-seen:${slug}`, "1");
    }, GAME_SLUGS);
  }
  await page.clock.setFixedTime(NOW);
  await replayApi(page, loadFixture(screen.fixture));
  await page.goto(screen.path);
  await settle(page);
  expect(blocked, "blocked by the Content-Security-Policy").toEqual([]);
}
