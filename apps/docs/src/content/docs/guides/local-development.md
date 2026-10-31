---
title: Local development
description: Run Probe on your machine. Postgres in Docker, schema push, demo data, both apps, and optional features.
---

This guide runs Probe on your machine. To put it online, see [Deployment](/docs/guides/deployment/). For how the pieces fit, see [Architecture](/docs/reference/architecture/).

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22 | `engines` allows 20 and up. The Dockerfile uses 22. |
| pnpm | 9 | `corepack enable`. The repo pins `pnpm@9.12.0`. |
| Docker | any | For the local Postgres. |

This is a Turborepo with pnpm workspaces. Use pnpm, not npm or yarn.

## Set up

```bash
# 1. Install dependencies
pnpm install

# 2. Start Postgres 17 on host port 5434
docker compose up -d postgresdb

# 3. Create .env and link it into every app and package
cp .env.example .env
./setup.sh

# 4. Set BETTER_AUTH_SECRET in .env (32+ characters)
openssl rand -base64 32

# 5. Create the tables and load the built-in themes
pnpm db:push && pnpm db:themes

# 6. Start everything
pnpm dev
```

`./setup.sh` copies `.env.example` to `.env` if it is missing, then symlinks `.env` into each folder under `apps/` and `packages/`. On Windows without symlink support, copy `.env` into each folder by hand.

The default `DATABASE_URL` in `.env.example` matches the Docker Compose database: `postgres://probe:probe_local@localhost:5434/probe_dev`.

## Ports

| Address | What |
|---|---|
| `http://localhost:3000` | Web app. Use this one. |
| `http://localhost:8000` | API |
| `http://localhost:8000/api/docs` | API reference |
| `http://localhost:4321/docs/` | This docs site, from `astro dev` |

In development, `NEXT_PUBLIC_API_URL=http://localhost:8000/trpc` in `.env.example` makes the browser call the API directly. In production it is left unset and the web app proxies the calls.

## Your first account

Open `http://localhost:3000/register`. The first account on a fresh database becomes the admin.

## Demo data

To fill the database with sample forms and responses:

```bash
pnpm db:seed
```

It creates two accounts, a set of themed forms, sample responses and analytics events. It is repeatable: running it again wipes and recreates the demo accounts' data.

| Role | Email | Password |
|---|---|---|
| Creator | `demo@probe.local` | `Probe@2025` |
| Admin | `admin@probe.local` | `ProbeAdmin@2025` |

These passwords are public. Never run `db:seed` against a database that is reachable from the internet.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Runs the web app, API and docs in watch mode. |
| `pnpm build` | Builds everything. |
| `pnpm check-types` | Type-checks every package. |
| `pnpm db:push` | Applies the Drizzle schema to the database. |
| `pnpm db:themes` | Loads or updates the built-in themes. |
| `pnpm db:seed` | Loads demo accounts and data. |
| `pnpm db:studio` | Opens Drizzle Studio to browse the database. |
| `pnpm reset-password <email> <new-password>` | Sets a new password for an account and signs it out everywhere. |
| `pnpm --filter @repo/docs build` | Builds this docs site. |

`reset-password` uses `DATABASE_URL` from `.env`. To use it against another database, set it inline:

```bash
DATABASE_URL="postgresql://…" pnpm reset-password you@example.com 'a-new-password'
```

`db:push` compares the schema with the database and applies the difference. It can drop columns you renamed. That is fine locally. Re-run `db:seed` if you lose demo data.

## Email locally

Without `RESEND_API_KEY`, nothing is sent. Links that would have been emailed are printed in the API's terminal:

- Endpoint-form verification links.
- Password-reset links.

Copy the link from the log and open it.

## Optional features

Add the variables to `.env`, then restart `pnpm dev`. See [Environment variables](/docs/reference/environment/) for the full list.

### AI form generation

Go to **Settings → AI form generation**, pick a provider and paste a key. Or set `AI_PROVIDER` and `AI_API_KEY` in `.env` to switch it on for every account. A local Ollama works with the **Custom** provider and base URL `http://localhost:11434/v1`. See [AI form generation](/docs/guides/ai-generation/).

### Discord

1. In Discord, go to **Server Settings → Integrations → Webhooks** and copy a webhook URL.
2. Sign in as admin, go to **Admin → Integrations** and enable Discord.
3. Open a form, go to its integrations and paste the webhook URL.

### Google Sheets

Create an OAuth client as described in the [deployment guide](/docs/guides/deployment/#google-sheets). Add the redirect URI `http://localhost:3000/api/integrations/google/callback`. Set `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`, restart, and enable it in **Admin → Integrations**.

### File uploads

Set the five `R2_*` variables. Add `http://localhost:3000` to the bucket's CORS `AllowedOrigins`. See the [deployment guide](/docs/guides/deployment/#file-uploads-with-cloudflare-r2).

## Troubleshooting

**Pages hang, then error.** Postgres is not running. Run `docker compose up -d postgresdb`.

**Docker on WSL lost the container.** Docker does not start by itself on WSL. Run `docker start probe-postgres`, or `docker compose up -d postgresdb`.

**`BETTER_AUTH_SECRET must be 32+ chars`.** Set it in `.env` and check that `./setup.sh` linked `.env` into each package.

**A `NEXT_PUBLIC_*` change does nothing.** These are baked in when Next.js builds. Restart `pnpm dev`.

**Ports 3000 to 3002 are taken after Ctrl-C.** Press Ctrl-C once and let Turbo stop the processes. If `next dev` is left running, find and stop it.

**There is no Makefile.** Use `pnpm dev`.

**The AI panel does not appear on New form.** Connect a provider in **Settings**, or set `AI_PROVIDER` and `AI_API_KEY`.

**Integrations are missing from a form.** An admin must enable each one in **Admin → Integrations** first. If its variables are missing, the admin page shows what to configure.
