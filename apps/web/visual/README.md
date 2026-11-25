# Visual regression and accessibility tests

Screenshots of every screen — sign-in, dashboard, all six games, a result screen, friends,
profile, settings, admin and the 404 page — in four variants each: desktop and phone, dark and
light. Each run compares them with the baselines committed in `__screenshots__/` and fails if
anything moved, changed shape or changed colour noticeably.

```bash
npm run test:visual -w @dailyloop/web          # compare against the baselines
npm run test:visual:update -w @dailyloop/web   # accept the current look as the new baseline
```

The same run checks every screen with axe-core (`a11y.visual.ts`) against WCAG 2.1 A/AA and
axe's best practices, in all four variants. Muted text is the likeliest thing to regress: use the
`text-fg-muted` and `text-fg-subtle` tokens rather than low-opacity white, which can't pass
contrast in both themes.

The first command builds the app and serves it with `vite preview` (production build, production
security headers). On a failure, `apps/web/test-results/` holds the expected, actual and diff
image for each screen; in CI they're uploaded as the `visual-diffs` artifact.

## What makes it deterministic

- **No backend.** Every API call is answered from `fixtures/<screen>.json`, recorded from a
  real API (see below). Requests nobody recorded answer 404, so a new endpoint shows up as a
  visibly broken screen rather than a hang.
- **Frozen clock and zone.** Time is fixed to the server time in the recorded schedule, in UTC
  with en-GB formatting, so countdowns, greetings and dates never change.
- **Fonts loaded first.** Every declared font face is loaded before the capture, so text never
  shifts when a late font file arrives.
- **Deterministic rendering.** Chromium runs with software raster on one thread and font hinting
  off (see `playwright.config.ts`). The default threaded GPU raster draws the same frame slightly
  differently from load to load.
- **Pinned browser.** `@playwright/test` is pinned to an exact version, so CI downloads the same
  Chromium build the baselines were made with.

## What it catches, and what it doesn't

No pixel may differ beyond a per-pixel colour tolerance of 0.35. That catches layout, spacing,
size, shape (a 4px change in a button's corner radius fails a third of the screens), visibility
and clear colour changes. It does not catch near-identical shades — one Tailwind step on small
text is below what pixel comparison can distinguish at any tolerance. It also covers only the
recorded states; interactions are covered by the Vitest suites in `src/`.

Baselines are per platform (`__screenshots__/linux/`). They were made on Ubuntu 24.04, like the
CI runners. On macOS or Windows, run the suite in the Linux Playwright Docker image rather than
committing screenshots from your machine.

## Re-recording the fixtures

The fixtures need refreshing when an API response changes shape. Record them from a fresh,
seeded database. That keeps them free of local test accounts, and since recording plays some
of the day's games, it needs a day nobody has played yet:

```bash
createdb dailyloop_fixtures
DATABASE_URL=postgresql://…/dailyloop_fixtures npm run db:migrate:deploy
DATABASE_URL=postgresql://…/dailyloop_fixtures npm run db:seed
psql …/dailyloop_fixtures -c "UPDATE \"User\" SET role = 'ADMIN' WHERE username = 'harry'"
DATABASE_URL=postgresql://…/dailyloop_fixtures npm run dev   # API on :4000, web on :5173
node apps/web/visual/record-fixtures.mjs
```

The profile's activity calendar in `fixtures/profile.json` is filled in by hand (a fresh database
has only a day of history to show); re-recording replaces it with the real, sparse history.

Then refresh the baselines with `npm run test:visual:update -w @dailyloop/web` and look through
the new images before committing them.
