# Probe

> Open source form builder. Self-hosted. Yours.

Google Forms has the design sense of a tax return. Typeform costs more than your Netflix. Probe is free, open source, beautiful, and ships as a single Docker container.

<p><img src="apps/web/public/logo.svg" alt="Probe" height="48"></p>

## Instance

| | |
|---|---|
| **App** | https://probe.riftfi.com |
| **Docs** | https://probe.riftfi.com/docs |
| **API reference (Scalar)** | https://probe.riftfi.com/api/docs |
| **For AI agents** | https://probe.riftfi.com/llms.txt (source: [`apps/web/public/llms.txt`](./apps/web/public/llms.txt)) |

## Minimum to self-host

Only three env vars are required; everything else is optional and degrades gracefully:

| Var | Why |
|---|---|
| `DATABASE_URL` | Postgres connection string (the Kamal deploy runs its own Postgres accessory and composes this for you) |
| `BETTER_AUTH_SECRET` | 32+ chars (`openssl rand -base64 32`). Signs sessions and encrypts stored secrets |
| `BETTER_AUTH_URL` + `PUBLIC_APP_URL` | Your public origin, e.g. `https://probe.riftfi.com` (Kamal sets both from `KAMAL_DEPLOY_HOST`) |

On boot the container pushes the schema and loads the built-in themes (`pnpm db:themes`). **The first account you register becomes the admin.** No demo seed is needed — don't run `pnpm db:seed` on a public instance, it creates demo accounts with well-known passwords.

Without optional services: no Resend → no emails (endpoint-form verification links are printed in the server logs instead); no Upstash → in-memory rate limiting; no R2 → no file-upload field; no Google OAuth → no Sheets integration.

## What's in the box

- **Two apps in the Turborepo** — `apps/api` (Express + tRPC + Scalar) and `apps/web` (Next.js). They run as separate apps; in production they're co-located in one image and the web app reverse-proxies API calls so the public surface stays single-origin.
- **Hosted forms** — themed form pages at `/f/<slug>` with a builder, 10 themes, conditional logic, password protection, an in-app reports page (filters, per-field charts), and CSV / Excel / PDF export.
- **Endpoint forms** — `POST` to `/submit` from any HTML. No UI to build. Honeypot + captcha + origin allowlist + AES-GCM encrypted secrets + signed webhooks.
- **HTML template gallery** — `/templates/html`: downloadable self-contained HTML pages (contact, newsletter, waitlist, feedback) pre-wired to the `/submit` endpoint. No account needed to grab a file; generating an access key takes two minutes.
- **AI form generation** — describe your form in plain English; Claude drafts the fields. You bring your own Anthropic API key (Probe never charges for AI). Key stored AES-256-GCM encrypted. Connect it in Dashboard → Settings; the "Generate with AI" panel appears on the new-form page.
- **Integrations: Discord + Google Sheets** — per-form webhook to a Discord channel, or live sync to a Google Sheet. Each integration is admin-enabled platform-wide; form owners then configure it in the builder. Delivery is non-blocking (never holds up a submission).
- **File uploads (Cloudflare R2)** — a `file_upload` field type backed by presigned R2 uploads. Requires R2 credentials in env; if unset the field type is simply hidden in the builder.
- **Admin dashboard** — platform-wide stats, cross-user form moderation (status/visibility/delete), user role management, and integration enable/disable toggles.
- **Donation nudges** — optional tip-jar prompts in the dashboard footer and after publish/export. Off by default; enable with `NEXT_PUBLIC_ENABLE_CHAI_NUDGE=true`.

## Stack

Turborepo · **tRPC** (type-safe APIs) · **Zod** (validation) · **Drizzle ORM** (Postgres) · **Scalar** (API docs) · Express (backend) · Next.js 14 (frontend) · Better Auth · Upstash rate limiting · Resend email · Anthropic SDK (optional, BYO key) · Cloudflare R2 (optional). Built on the [`piyushgarg-dev/trpc-monorepo`](https://github.com/piyushgarg-dev/trpc-monorepo) starter structure.

## Quick start

```bash
# 1. Install deps
pnpm install

# 2. Start local Postgres (docker compose — postgres:17 on :5434)
docker compose up -d postgresdb

# 3. Env: defaults already point at the compose DB; set BETTER_AUTH_SECRET
cp .env.example .env
./setup.sh                        # symlinks root .env into each app/package

# 4. Push schema + load themes (optionally: pnpm db:seed for demo users/forms/responses)
pnpm db:push
pnpm db:themes

# 5. Run BOTH apps (api on :8000, web on :3000)
pnpm dev
# → web   http://localhost:3000
# → api   http://localhost:8000   (API reference at /api/docs)
# → docs  http://localhost:4321/docs   (Astro Starlight authoring server)
```

The app serves the built docs site at `/docs`; run `pnpm --filter @repo/docs build` once so `http://localhost:3000/docs` is populated (or use the live-reload authoring server above).

In development set `NEXT_PUBLIC_API_URL=http://localhost:8000/trpc` (so the browser hits the api directly) — in production it's left unset and the web app proxies `/trpc` to the api. See `.env.example`.

Register at `/register` — the first account becomes admin. (If you ran `pnpm db:seed`: creator `demo@probe.local` / `Probe@2025`, admin `admin@probe.local` / `ProbeAdmin@2025`.) Docs at [`/docs`](http://localhost:3000/docs); API reference (Scalar) at [`/api/docs`](http://localhost:3000/api/docs).

## Docs

The documentation site lives in **`apps/docs`** (Astro + [Starlight](https://starlight.astro.build)) and is served at **`/docs`** on a running instance. Source pages:

| Guide | Source | What it covers |
|---|---|---|
| Local development | [`guides/local-development.md`](./apps/docs/src/content/docs/guides/local-development.md) | Full local walkthrough, optional features, troubleshooting |
| Deployment | [`guides/deployment.md`](./apps/docs/src/content/docs/guides/deployment.md) | Kamal, GitHub Actions, secrets & masking, first-time setup |
| Environment variables | [`reference/environment.md`](./apps/docs/src/content/docs/reference/environment.md) | Every env var: scope, required/optional, default, what it gates |
| Architecture | [`reference/architecture.md`](./apps/docs/src/content/docs/reference/architecture.md) | Request lifecycle, auth, integrations, uploads, AI, theme system |

## Repo layout (Turborepo)

```
apps/
  api/          @repo/api   — Express server: tRPC (/trpc), Scalar API ref (/api/docs),
                              Better Auth (/api/auth), /submit, exports, serves the
                              docs site at /docs. Runs on :8000.
  web/          web         — Next.js 14 frontend; tRPC React client over HTTP,
                              reverse-proxies API paths to apps/api. Runs on :3000.
  docs/         @repo/docs  — Astro + Starlight documentation site, built to a
                              static bundle and served by the api at /docs.
packages/
  database/     @repo/database          — Drizzle schema (models/) + node-postgres + seed
  trpc/         @repo/trpc              — tRPC server (routes/, context, auth) + client types
  services/     @repo/services          — Zod validators (/validators), email, lib utils
  logger/       @repo/logger            — winston logger
  eslint-config/        @repo/eslint-config
  typescript-config/    @repo/typescript-config
config/deploy.yml         Kamal — single service + Postgres accessory
Dockerfile                Builds web, runs api (tsx) + web together, single origin
docker-compose.yml        Local Postgres
```

## Deploy

Deploys run from **Actions → Deploy → Run workflow** (manual `workflow_dispatch`), picking a Kamal action: `setup` (first provision), `deploy`, `redeploy`, `rollback`, `migrate`, `seed`, `db-reset-password`, `logs`, `logs-errors`, `proxy-reboot`, `prune`.

First-time setup:

```
1. Actions → Deploy → action: setup     # provisions host, boots Postgres + app
2. Open https://<your-domain>/register   # first account becomes admin
```

After that, `deploy` ships new code. `seed` (optional, demo instances only) loads demo data (idempotent — it
wipes and re-seeds the demo account only).

> **Rotated `POSTGRES_PASSWORD`?** Postgres only applies that password when it
> first initializes an *empty* data dir. The accessory's `data` volume persists
> across deploys, so changing the secret afterward leaves the existing role on
> the **old** password while the app connects with the **new** one — every query
> fails with `FATAL: password authentication failed` (`28P01`). Run the
> **`db-reset-password`** action once to reconcile the live role to the current
> secret (in place, no data loss), then re-run `migrate` / `seed`.

**Required GitHub Environment secrets** (Settings → Environments → `production`):

| Secret | What |
|---|---|
| `KAMAL_REGISTRY_USERNAME` / `KAMAL_REGISTRY_PASSWORD` | Docker Hub username + **PAT** (`dckr_pat_…`) |
| `SSH_PRIVATE_KEY` | key for the deploy host |
| `KAMAL_SERVER_HOST` | server IP / hostname |
| `KAMAL_DEPLOY_HOST` | public domain — `probe.riftfi.com` |
| `POSTGRES_PASSWORD` | Postgres password (also composes `DATABASE_URL`) |
| `BETTER_AUTH_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY` | app secrets |
| `NEXT_PUBLIC_*` | GitHub / X / LinkedIn / Razorpay links, nudge flag — **baked at build time** |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | Google Sheets integration (optional) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | Cloudflare R2 file uploads (optional) |

`KAMAL_DEPLOY_HOST` drives the domain, SSL, `PUBLIC_APP_URL`, and `BETTER_AUTH_URL` — set it to `probe.riftfi.com`. The Kamal deploy boots one container + one Postgres accessory on a single VPS. See [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) for the full production guide and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the deployment shape table.

## License

MIT.

— *Probe is based on [ChaiForm](https://github.com/developedbysaad) by Saad (MIT).*
