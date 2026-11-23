# Deployment

DailyLoop has no `localhost` URLs hard-coded anywhere — every environment-specific value comes
from env vars (see [.env.example](../.env.example)), so none of the steps below need source
changes.

## Quick deploy (Render Blueprint)

The repo includes [`render.yaml`](../render.yaml), a Render Blueprint that provisions all three
pieces — the API, the static web app, and a free Postgres database — in one pass, with
`APP_SECRET` auto-generated and the API/web URLs wired to each other automatically.

1. Push this repo to GitHub (already done if you're reading this from the deployed copy).
2. On [Render](https://dashboard.render.com), click **New +** → **Blueprint**, and connect this
   repo. Render reads `render.yaml` and shows the three resources it's about to create.
3. Click **Apply**. First deploy takes a few minutes (it also runs `prisma migrate deploy`
   automatically as part of the API's start command).
4. Once both services show "Live", open the API service's **Shell** tab and run:
   ```bash
   npm run db:seed
   ```
   This creates the 6 games, the achievement catalog, and 30 days of daily puzzles — without it
   the site loads but shows no games. It also creates a dev admin account and demo users; trim
   `DEV_ADMIN`/`DEMO_USERS` in `prisma/seed.ts` first if you don't want those in a shared deploy.
5. Open the web service's URL (shown on its Render dashboard page) and register an account.

Render's free tier spins down a web service after 15 minutes idle — the next request wakes it in
20–30s. Fine for casually playing with friends; upgrade to a paid instance type if that cold start
bothers you. Free Postgres databases on Render also expire after 30 days — re-run `db:seed` (or
just don't let it sit unused that long) if you want this to stay up long-term.

## Architecture

- **`apps/web`** — a static Vite build. Deploy it to any static host (Vercel, Netlify, Cloudflare
  Pages, a plain S3 bucket + CDN).
- **`apps/api`** — a long-running Node process (it holds an in-memory Fastify server, not a
  serverless function). Deploy it to a host that runs persistent processes: Render, Railway, Fly,
  or a container platform.
- **Database** — managed PostgreSQL: Neon, Supabase, or the host's own Postgres add-on
  (Render/Railway both offer one).

## Environment variables

Set these on the API host:

| Variable            | Example                                          | Notes                                             |
| ------------------- | ------------------------------------------------- | -------------------------------------------------- |
| `DATABASE_URL`         | `postgresql://user:pass@host:5432/db?sslmode=require` | From your managed Postgres provider           |
| `NODE_ENV`             | `production`                                       |                                                    |
| `PORT`                 | (usually set by the host itself)                   | Falls back to `4000` if unset                     |
| `CORS_ORIGIN`          | `https://your-web-domain.com`                      | Comma-separate multiple origins                   |
| `WEB_APP_URL`          | `https://your-web-domain.com`                      | Used to build the password-reset link              |
| `APP_SECRET`           | output of `openssl rand -hex 32`                   | Never reuse the dev value                         |
| `DEFAULT_TIMEZONE`     | `Asia/Kathmandu`                                   | Optional — this is already the default            |
| `CRON_SECRET`          | output of `openssl rand -hex 32`                   | Bearer token for `POST /api/cron/generate-tomorrow` (pre-generates puzzles, purges expired sessions). Unset disables the endpoint |
| `TRUST_PROXY`          | `1`                                                | Number of proxies in front of the API, so rate limits see the real client IP. Default `1`; never `true` unless every hop strips client-supplied `X-Forwarded-For` |

Set this on the web host (build-time):

| Variable        | Example                          |
| ---------------- | --------------------------------- |
| `VITE_API_URL`      | `https://your-api-domain.com/api` |

## Build & start commands

```bash
# apps/web — static build, output in apps/web/dist
npm run build -w @dailyloop/web

# apps/api — no build step (runs via tsx, see docs/architecture.md); the start
# command a platform should run:
npm start -w @dailyloop/api
```

## Database migrations

Run once per deploy, before the API starts serving traffic (a release step, or manually):

```bash
npm run db:migrate:deploy
```

This runs `prisma migrate deploy`, which only applies already-committed migrations — never use
`npm run db:migrate` (the dev command) in production; it can prompt interactively and is meant
for authoring new migrations locally.

To seed a **fresh** production database with the admin account and initial games/achievements
(skip this if you don't want the demo users or dev admin credentials in production — see the
seed script's `DEV_ADMIN`/`DEMO_USERS` constants to trim it down first):

```bash
npm run db:seed
```

## Docker

Each app can be containerized independently if a platform prefers that over a native Node
buildpack — `apps/api` runs on plain Node + npm (`argon2` ships prebuilt binaries, so there's no
compiler needed for common platforms), and
`apps/web`'s build output is static files servable by any web server (nginx, Caddy, etc.).

## Checklist before going live

- [ ] Change or remove the seeded dev admin account (`admin@dailyloop.dev` / `DevAdmin123!`)
- [ ] Generate a fresh `APP_SECRET` — don't reuse the one from `.env.example`
- [ ] Point `CORS_ORIGIN` / `WEB_APP_URL` at your real domains, not `localhost`
- [ ] Confirm `DATABASE_URL` uses `sslmode=require` (most managed Postgres providers require this)
- [ ] Wire up a real email provider for password resets if you need that flow to work for real
      users. Until then, outside production the reset link is logged; in production it is not
      logged (a warning is), so resets can't be completed — see `apps/api/src/routes/auth.ts`
- [ ] Set `TRUST_PROXY` to the number of proxies/load balancers in front of the API on your host
- [ ] Set `CRON_SECRET` on the API and `API_BASE_URL`/`CRON_SECRET` as GitHub Actions secrets so
      `.github/workflows/pregenerate-puzzles.yml` pre-generates each day's puzzles
