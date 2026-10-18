---
title: "Local Development Setup"
description: "Run Probe locally: install, database, env, and enabling optional features."
---

Everything you need to run Probe on your machine. For production, see [`DEPLOYMENT.md`](/docs/guides/deployment/). For architecture, see [`ARCHITECTURE.md`](/docs/reference/architecture/).

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22 (LTS) | `engines` field enforces `>=20`; 22 is used in CI and the Dockerfile |
| pnpm | 9.x | `corepack enable && corepack use pnpm@9` |
| Docker | any | For local Postgres |

This is a Turborepo + pnpm workspace. Use **pnpm**, not npm or yarn.

---

## 2. Local setup

```bash
# 1. Install all workspace dependencies
pnpm install

# 2. Start Postgres (the app doesn't start its own DB)
#    The docker-compose.yml runs postgres:17 on host port 5434.
docker compose up -d postgresdb

# 3. Copy the env template and run the setup script
cp .env.example .env
./setup.sh          # symlinks .env into each app and package

#    Minimum: set BETTER_AUTH_SECRET to a random 32-char string:
#    openssl rand -base64 32

# 4. Push the schema and seed demo data
pnpm db:push        # pushes Drizzle schema to Postgres (dev-speed drop/recreate)
pnpm db:seed        # loads 10 themes, demo user, 5 forms, ~165 responses, analytics

# 5. Start both apps
pnpm dev
# → web  http://localhost:3000
# → api  http://localhost:8000  (API docs at http://localhost:8000/docs)
```

**Demo logins**

| Role | Email | Password |
|---|---|---|
| Creator | `demo@probe.local` | `Probe@2025` |
| Admin | `admin@probe.local` | `ProbeAdmin@2025` |

In development, `NEXT_PUBLIC_API_URL=http://localhost:8000/trpc` (set in `.env.example`) makes the browser hit the API directly instead of going through the Next.js reverse proxy. In production this variable is left unset and the proxy is used.

---

## 3. Environment keys

Copy `.env.example` to `.env` and fill in the values you need. The annotated template is the authoritative key reference. For the full table of every variable, see [`ENVIRONMENT.md`](/docs/reference/environment/).

**Minimum required**

| Key | How to get it |
|---|---|
| `DATABASE_URL` | The docker-compose default (`postgres://probe:probe_local@localhost:5434/probe_dev`) works out of the box |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` — also the master key for AES-GCM encryption and IP-hash salt; rotating it logs everyone out |
| `BETTER_AUTH_URL` | `http://localhost:3000` for local dev |

**Optional — degrade gracefully when unset**

| Key | What happens without it |
|---|---|
| `UPSTASH_REDIS_REST_URL/TOKEN` | Rate limiting becomes a permissive no-op (warning logged) |
| `RESEND_API_KEY` | Email is a no-op; submissions are stored and visible in the dashboard |

> `NEXT_PUBLIC_*` values are baked into the client bundle at **build time** by Next.js. Changing them in `.env` after the app is already running requires restarting `pnpm dev` (Next rebuilds) — or a full `pnpm build` in production. Never put secrets in `NEXT_PUBLIC_*` variables.

---

## 4. Database commands

```bash
pnpm db:push        # push schema changes (drops and recreates; fine for dev)
pnpm db:seed        # idempotent reseed — wipes the demo account and re-creates it
pnpm db:studio      # open Drizzle Studio in the browser
```

`db:push` is fine for local iteration. Before exposing the app to real users, switch to `drizzle-kit generate` + committed SQL migration files (see the migrations note in `ARCHITECTURE.md`).

---

## 5. Enabling optional features locally

### AI form generation

1. Go to Dashboard → Settings.
2. Paste your Anthropic API key (`sk-ant-…`) from [console.anthropic.com](https://console.anthropic.com/settings/keys).
3. The key is stored AES-256-GCM encrypted on your user row.
4. Return to Dashboard → Forms → New — the "✨ Generate with AI" panel now appears.

Probe never charges for AI. All Anthropic API costs go to your own account.

### Discord integration

1. In Discord: Server Settings → Integrations → Webhooks → New Webhook → copy the URL.
2. Log in as admin, go to Dashboard → Admin, and enable the Discord integration.
3. As any user, open a form in the builder, go to Integrations, and paste the webhook URL for that form.

No global Discord env var is needed. The webhook URL is stored per form.

### Google Sheets integration

1. Add to your `.env`:
   ```
   GOOGLE_OAUTH_CLIENT_ID=<your-client-id>
   GOOGLE_OAUTH_CLIENT_SECRET=<your-client-secret>
   ```
   For local testing, create a Google Cloud OAuth client with redirect URI `http://localhost:3000/api/integrations/google/callback`. Follow the full GCP walkthrough in [`/docs/guides/deployment/`](/docs/guides/deployment/#step-by-step-creating-a-google-cloud-oauth-client) — in particular you must **enable the Google Sheets API** and, while the consent screen is in *Testing*, **add your Google account as a Test user** (otherwise the connect step fails with `access_denied`).
2. Restart `pnpm dev` so the API picks up the new env vars.
3. Log in as admin, Dashboard → Admin, enable the Google Sheets integration.
4. As a form owner, open the form builder → Integrations → Google Sheets → Connect Google account → authorise.

If `GOOGLE_OAUTH_CLIENT_ID` is unset, the admin toggle shows "Configure Google OAuth to enable" and the integration is not available.

### File uploads (Cloudflare R2)

1. Add to your `.env`:
   ```
   R2_ACCOUNT_ID=
   R2_ACCESS_KEY_ID=
   R2_SECRET_ACCESS_KEY=
   R2_BUCKET=
   R2_PUBLIC_BASE_URL=
   ```
2. **Configure bucket CORS** so the browser can upload directly to R2 — R2 → bucket → Settings → CORS policy, allowing `PUT`/`GET` from `http://localhost:3000` (and your prod domain). Full policy in [`/docs/guides/deployment/`](/docs/guides/deployment/#step-by-step-creating-a-cloudflare-r2-bucket--api-token). Without it the upload PUT fails with a CORS error even though presigning works.
3. Restart `pnpm dev`.
4. The `file_upload` field type now appears in the form builder.

Without these vars the field type is hidden. All other field types and existing forms are unaffected.

### Donation nudges

Set `NEXT_PUBLIC_ENABLE_CHAI_NUDGE=true` in `.env`, then restart `pnpm dev`. A "buy me a chai" prompt appears in the dashboard footer and after publish/export actions. Self-hosters should leave this `false` (the default) so their users don't see our donate link.

---

## 6. Form features

Built into the hosted-form builder + renderer:

- **Field types**: short/long text, email, number, phone, URL, date, single/multi select, checkbox, rating, linear scale (with end labels), ranking, address, time, signature (drawn, stored as a PNG data-URL), and **file upload** (R2-backed; requires env).
- **Multi-page** forms via a `page_break` field, with progress bar and Back/Next. Or set layout to **one question per page**.
- **Save & resume**: answers autosave to `localStorage` and restore on return; cleared on submit.
- **Conditional logic**: show/hide a field based on earlier answers.
- **Answer piping**: `{{<fieldId>}}` in labels, help text, page titles, or descriptions injects an earlier answer.
- **Quiz scoring**: give select options a score; define score-range outcomes shown on the success screen.
- **Respondent flow**: confirmation email to the submitter, custom redirect after submit, URL prefill (`?<fieldId>=value`), hidden fields for tracking params.
- **Integrations**: Discord channel notification and Google Sheets live-sync, both per-form (admin must enable each platform-wide first).
- **Exports**: CSV / XLSX / PDF, for both hosted forms and endpoint forms.

---

## 7. Exporting responses

```
GET /api/forms/:formId/export.csv    # UTF-8 + BOM, Excel-friendly
GET /api/forms/:formId/export.xlsx   # real .xlsx (exceljs), styled header + autofilter
GET /api/forms/:formId/export.pdf    # real PDF (pdf-lib), one block per response
        ?from=<ISO>&to=<ISO>         # optional date range
```

All routes are authenticated and owner-scoped.

---

## 8. Troubleshooting

**Page hangs then errors**
Postgres isn't running. `docker compose up -d postgresdb`, then re-try. The pool fails fast (`connectionTimeoutMillis: 5s`) rather than hanging for minutes.

**`make dev` fails**
There is no Makefile. Use `pnpm dev`.

**Docker on WSL dropped the container**
Docker doesn't auto-start on WSL. `docker start probe-postgres` if the container still exists, or rerun `docker compose up -d postgresdb`. Re-seed if needed (`pnpm db:seed`).

**`NEXT_PUBLIC_*` change has no effect**
These variables are inlined at build time by Next.js. Changing them in `.env` requires restarting `pnpm dev` (Next will rebuild the affected pages). Changing them in `.env` without restarting the dev server has no effect.

**Ctrl-C doesn't stop the dev server cleanly**
One Ctrl-C and wait for Turbo to drain. Mashing it leaves orphaned `next dev` processes squatting ports 3000–3002. Check with `lsof -i :3000` and kill manually if needed.

**Drizzle push errors on column rename**
`db:push` drops and recreates — it doesn't migrate data. If you renamed a column, run `pnpm db:seed` afterwards to repopulate the demo data.

**AI generation panel doesn't appear**
You need an Anthropic API key saved in Settings first. The panel is hidden until `trpc.ai.status` returns `hasKey: true`.

**Integrations are greyed out in the builder**
The integration must be enabled platform-wide by an admin (Dashboard → Admin) before it appears in the form builder. If the required env vars are missing, the admin toggle shows a "Configure … to enable" message instead.

---

— *Probe is based on [ChaiForm](https://github.com/developedbysaad) by Saad (MIT).*
