// Re-records visual/fixtures/*.json: the API responses each screen makes, which the visual tests
// replay. Run it against a fresh, seeded database — see visual/README.md for the full steps.
//
//   node apps/web/visual/record-fixtures.mjs
//
// Expects the API on http://localhost:4000 and the web dev server on http://localhost:5173.
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const API = "http://localhost:4000/api";
const WEB = "http://localhost:5173";
const OUT = new URL("./fixtures/", import.meta.url);

// 1. Give the demo players some of today's results, so leaderboards and result screens have data.
async function login(username) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: WEB },
    body: JSON.stringify({ emailOrUsername: username, password: "DemoPass123!" }),
  });
  if (!res.ok) throw new Error(`login ${username}: ${res.status}`);
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return async (path, body) => {
    const r = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { cookie, origin: WEB, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(`${username} ${path}: ${r.status} ${await r.text()}`);
  };
}

async function todaysAnswer(slug) {
  // Sign in as the admin to read today's puzzle content from the admin API.
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: WEB },
    body: JSON.stringify({ emailOrUsername: "admin", password: "DevAdmin123!" }),
  });
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const schedule = await (await fetch(`${API}/games/schedule`)).json();
  const list = await (
    await fetch(`${API}/admin/puzzles?gameSlug=${slug}&date=${schedule.data.today}`, {
      headers: { cookie, origin: WEB },
    })
  ).json();
  return list.data[0].content.answer;
}

async function play(call, slug, guesses) {
  await call(`/games/${slug}/attempts/start`);
  for (const guess of guesses) await call(`/games/${slug}/attempts/submit`, { move: { guess } });
}

const word = await todaysAnswer("word-guess");
const mystery = await todaysAnswer("guess-it");
const wrongWord = word === "CRANE" ? "SLATE" : "CRANE";
await play(await login("sumit"), "word-guess", [wrongWord, word]);
await play(await login("sumit"), "guess-it", [mystery]);
await play(await login("aayush"), "guess-it", ["Not it", mystery]);
await play(await login("sagar"), "guess-it", ["Still not it", mystery]);
const harry = await login("harry");
await play(harry, "guess-it", [mystery]);
await play(harry, "word-guess", [wrongWord]);

// 2. Browse every screen as harry and keep what the API said.
const SCREENS = [
  ["dashboard", "/"],
  ["connections", "/play/connections"],
  ["word-guess", "/play/word-guess"],
  ["number-puzzle", "/play/number-puzzle"],
  ["logic-puzzle", "/play/logic-puzzle"],
  ["guess-it", "/play/guess-it"],
  ["pathway", "/play/pathway"],
  ["friends", "/friends"],
  ["profile", "/u/harry"],
  ["settings", "/settings"],
  ["admin", "/admin"],
  ["admin-puzzles", "/admin/puzzles"],
  ["admin-users", "/admin/users"],
];

function recorder(page) {
  let current = null;
  page.on("response", async (res) => {
    const url = new URL(res.url());
    if (!url.href.startsWith(API) || res.request().method() === "OPTIONS") return;
    const body = await res.json().catch(() => null);
    const key = `${res.request().method()} ${url.pathname.replace(/^\/api/, "")}${url.search}`;
    if (current) current[key] = { status: res.status(), body };
  });
  return {
    start: () => (current = {}),
    stop: () => {
      const recorded = current;
      current = null;
      return recorded;
    },
  };
}

function save(name, data) {
  // The admin puzzle list runs to hundreds of entries; two pages' worth is plenty.
  const puzzles = data["GET /admin/puzzles"]?.body?.data;
  if (Array.isArray(puzzles)) data["GET /admin/puzzles"].body.data = puzzles.slice(0, 40);
  writeFileSync(new URL(`${name}.json`, OUT), JSON.stringify(data, null, 2) + "\n");
}

const browser = await chromium.launch();
{
  const page = await browser.newPage();
  const rec = recorder(page);
  rec.start();
  await page.goto(`${WEB}/login`);
  await page.waitForTimeout(1500);
  save("login", rec.stop());
}
const page = await browser.newPage();
await page.goto(`${WEB}/login`);
await page.getByLabel(/Email or username/i).fill("harry");
await page.getByLabel("Password", { exact: true }).fill("DemoPass123!");
await page.getByRole("button", { name: /log in/i }).click();
await page.waitForURL(`${WEB}/`);
const rec = recorder(page);
for (const [name, path] of SCREENS) {
  rec.start();
  await page.goto(WEB + path);
  await page.waitForTimeout(name === "logic-puzzle" ? 2500 : 1800);
  save(name, rec.stop());
  console.log(`recorded ${name}`);
}
await browser.close();
