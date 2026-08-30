# Deployment

DailyLoop has no `localhost` URLs hard-coded anywhere — every environment-specific value comes
from env vars (see [.env.example](../.env.example)), so none of the steps below need source
changes.

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
buildpack — `apps/api`'s runtime dependencies are plain Node + npm (no native build step), and
`apps/web`'s build output is static files servable by any web server (nginx, Caddy, etc.).

## Checklist before going live

- [ ] Change or remove the seeded dev admin account (`admin@dailyloop.dev` / `DevAdmin123!`)
- [ ] Generate a fresh `APP_SECRET` — don't reuse the one from `.env.example`
- [ ] Point `CORS_ORIGIN` / `WEB_APP_URL` at your real domains, not `localhost`
- [ ] Confirm `DATABASE_URL` uses `sslmode=require` (most managed Postgres providers require this)
- [ ] Wire up a real email provider for password resets (currently logs the reset link to the
      server console — see the `EmailSender` note in `apps/api/src/routes/auth.ts`) if you need
      that flow to work for real users
