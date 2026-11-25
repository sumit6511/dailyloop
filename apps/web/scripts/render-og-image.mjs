// Renders public/og-image.png, the 1200×630 picture shown when a DailyLoop link is shared.
//
//   node apps/web/scripts/render-og-image.mjs
//
// Drawn from HTML in the app's own style with the bundled fonts (the icon font loads from Google,
// so this needs network access). Re-run after changing the brand, the games or the tagline.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = new URL("../../../", import.meta.url);
// Inlined as data: URIs: a page opened with setContent() can't load file:// fonts.
const font = (pkg, file) =>
  `data:font/woff2;base64,${readFileSync(
    new URL(`node_modules/@fontsource-variable/${pkg}/files/${file}`, root),
  ).toString("base64")}`;
const OUT = fileURLToPath(new URL("../public/og-image.png", import.meta.url));

const GAMES = [
  ["Connections", "grid_view", "#34d399"],
  ["Word Guess", "abc", "#fbbf24"],
  ["Number Puzzle", "calculate", "#38bdf8"],
  ["Logic Puzzle", "psychology", "#2dd4bf"],
  ["Guess It", "adjust", "#e879f9"],
  ["Pathway", "route", "#818cf8"],
];

const html = `<!doctype html>
<html><head><meta charset="utf-8" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,500,0,0&display=block" />
<style>
  @font-face { font-family: "Inter"; src: url(${font("inter", "inter-latin-wght-normal.woff2")}); font-weight: 100 900; }
  @font-face { font-family: "Space Grotesk"; src: url(${font("space-grotesk", "space-grotesk-latin-wght-normal.woff2")}); font-weight: 300 700; }
  @font-face { font-family: "JetBrains Mono"; src: url(${font("jetbrains-mono", "jetbrains-mono-latin-wght-normal.woff2")}); font-weight: 100 800; }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; font-family: Inter, sans-serif; color: #fff;
    background:
      radial-gradient(ellipse 70% 70% at 8% 0%, rgb(124 77 255 / .45), transparent 60%),
      radial-gradient(ellipse 60% 60% at 100% 100%, rgb(34 211 238 / .22), transparent 60%),
      #04060d; }
  .grid { position: absolute; inset: 0;
    background-image: linear-gradient(rgb(255 255 255 / .05) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / .05) 1px, transparent 1px);
    background-size: 48px 48px; mask-image: radial-gradient(ellipse 80% 80% at 30% 20%, #000 30%, transparent 80%); }
  .wrap { position: relative; display: flex; height: 100%; padding: 72px 80px; gap: 56px; align-items: center; }
  .left { flex: 1; }
  .brand { display: flex; align-items: center; gap: 16px; font-family: "Space Grotesk"; font-weight: 700; font-size: 34px; letter-spacing: -0.02em; }
  .brand b { background: linear-gradient(100deg, #bcabff, #67e8f9); -webkit-background-clip: text; color: transparent; }
  .eyebrow { margin-top: 56px; font-family: "JetBrains Mono"; font-size: 18px; letter-spacing: .18em; text-transform: uppercase; color: #67e8f9; }
  h1 { margin-top: 16px; font-family: "Space Grotesk"; font-weight: 700; font-size: 76px; line-height: 1.02; letter-spacing: -0.03em; }
  h1 span { background: linear-gradient(100deg, #bcabff, #67e8f9); -webkit-background-clip: text; color: transparent; }
  p { margin-top: 24px; font-size: 26px; color: rgb(255 255 255 / .68); max-width: 560px; line-height: 1.35; }
  .games { display: grid; grid-template-columns: repeat(2, 200px); gap: 14px; }
  .game { display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: 18px;
    border: 1px solid rgb(255 255 255 / .1); background: linear-gradient(180deg, rgb(255 255 255 / .07), rgb(255 255 255 / .02)); font-size: 18px; font-weight: 600; }
  .icon { display: flex; width: 44px; height: 44px; border-radius: 12px; align-items: center; justify-content: center; }
  .material-symbols-rounded { font-family: "Material Symbols Rounded"; font-size: 26px; line-height: 1; }
</style></head>
<body><div class="grid"></div><div class="wrap">
  <div class="left">
    <div class="brand">
      <svg viewBox="0 0 100 100" width="48" height="48"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#9b7bff"/><stop offset="100%" stop-color="#2dd4bf"/></linearGradient></defs>
      <path d="M 55.9 83.48 A 34 34 0 1 1 83.48 55.9" fill="none" stroke="url(#g)" stroke-width="15" stroke-linecap="round"/></svg>
      <span>Daily<b>Loop</b></span>
    </div>
    <div class="eyebrow">Daily puzzles</div>
    <h1>Six puzzles.<br /><span>Every day.</span></h1>
    <p>Words, numbers and logic in a few minutes a day. Keep your streak, beat your friends.</p>
  </div>
  <div class="games">
    ${GAMES.map(([name, icon, color]) => `<div class="game"><span class="icon" style="background:${color}26;color:${color}"><span class="material-symbols-rounded">${icon}</span></span>${name}</div>`).join("")}
  </div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: OUT });
await browser.close();
console.log(`wrote ${OUT}`);
