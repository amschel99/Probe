---
title: "Deployment Guide"
description: "Ship Probe to production with Kamal + GitHub Actions, secrets, and integrations."
---

Probe ships as a single Docker image deployed via **Kamal** onto a single VPS. GitHub Actions handles CI and all deploy operations through a manual `workflow_dispatch` workflow — no code push triggers deploys automatically.

For local development, see [`SETUP.md`](/docs/guides/local-development/). For architecture, see [`ARCHITECTURE.md`](/docs/reference/architecture/). For the complete env-var reference, see [`ENVIRONMENT.md`](/docs/reference/environment/).

---

## How it works

One Docker image runs two Node processes inside one container:

- `apps/api` — Express + tRPC + Scalar on `:8000` (internal only)
- `apps/web` — Next.js on `:3000` (public); reverse-proxies `/trpc`, `/api/auth`, `/submit`, and `/docs` to the API

`kamal-proxy` on the host terminates TLS (Let's Encrypt) and routes all traffic to port 3000 in the container. Postgres runs as a Kamal accessory on the same host.

The result is a single-origin app: one DNS record, one cert, one container, one port.

---

## GitHub Actions workflow

**Actions → Deploy → Run workflow** is the only way to deploy.

| Input | Options | Notes |
|---|---|---|
| `action` | `deploy`, `redeploy`, `rollback`, `setup`, `migrate`, `seed`, `logs`, `logs-errors`, `proxy-reboot`, `prune` | Default: `deploy` |
| `ref` | branch, tag, or SHA | Default: `main` |

What each action does:

| Action | Effect |
|---|---|
| `setup` | Provisions the host: installs Docker, boots `kamal-proxy`, starts Postgres accessory, deploys app container for the first time |
| `deploy` | Builds a new image, pushes to Docker Hub, rolls it out with zero-downtime swap |
| `redeploy` | Re-deploys the same image (useful after env-var-only changes that don't need a new build) |
| `rollback` | Rolls back to the previous container image |
| `migrate` | Runs `drizzle-kit push --force` inside the live container |
| `seed` | Runs `pnpm db:seed` inside the live container (idempotent; wipes and recreates the demo account only) |
| `logs` | Streams the last 500 container log lines via SSH |
| `logs-errors` | Streams only error-level log lines from the last 24 hours |
| `proxy-reboot` | Reboots `kamal-proxy` (TLS renewal issues, proxy config changes) |
| `prune` | Prunes old images and stopped containers on the host |

---

## First-time setup

```
1. Configure all GitHub Environment secrets (see next section).
2. Actions → Deploy → action: setup   # provisions host, boots Postgres + app
3. Actions → Deploy → action: seed    # loads demo user, themed forms, responses
4. Visit https://<your-domain>        # should show the landing page
```

After setup, `deploy` ships code changes and `seed` re-loads demo data whenever needed.

---

## GitHub Environment secrets

All secrets live under **Settings → Environments → `production`** in your GitHub repository. The workflow exports them as env vars; Kamal reads them through `.kamal/secrets` (which only contains `$VAR` references and is safe to commit).

### Required — deploy will fail without these

| Secret | What it is |
|---|---|
| `SSH_PRIVATE_KEY` | Private key matching a public key on the deploy host (root or deploy user) |
| `KAMAL_SERVER_HOST` | IP address or hostname of the target VPS |
| `KAMAL_DEPLOY_HOST` | Public domain, e.g. `probe.yourdomain.com` — drives TLS, `BETTER_AUTH_URL`, `PUBLIC_APP_URL` |
| `KAMAL_REGISTRY_USERNAME` | Docker Hub username |
| `KAMAL_REGISTRY_PASSWORD` | Docker Hub PAT starting with `dckr_pat_` (not your account password) |
| `POSTGRES_PASSWORD` | Password for the Postgres accessory |
| `BETTER_AUTH_SECRET` | 32+ char random string (`openssl rand -base64 32`). Also the master key for AES-GCM encryption and IP-hash salt — rotating it logs everyone out. |

### Required for full functionality

| Secret | What it is |
|---|---|
| `DATABASE_URL` | Composed automatically in `.kamal/secrets` from `KAMAL_SERVER_HOST` + `POSTGRES_PASSWORD`; do not set this separately |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL — rate limiting (omit to run without rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `RESEND_API_KEY` | Resend API key — email delivery (omit and email becomes a no-op) |

### NEXT_PUBLIC_* — build-time client config

> **Important:** `NEXT_PUBLIC_*` variables are inlined into the JavaScript bundle at `next build` time. They are not read at container startup. Kamal passes them as Docker build args (declared in `config/deploy.yml → builder.args` and in the `Dockerfile` as `ARG`/`ENV`). Changing them requires a new `deploy` (which triggers a rebuild), not just a `redeploy`.

> The build args actually wired into the image are `NEXT_PUBLIC_RAZORPAY_DONATE_LINK`, `NEXT_PUBLIC_GITHUB_URL`, `NEXT_PUBLIC_TWITTER_URL`, `NEXT_PUBLIC_LINKEDIN_URL`, and `NEXT_PUBLIC_ENABLE_CHAI_NUDGE` (see `config/deploy.yml → builder.args` and the `Dockerfile`). The app's public origin is read **server-side** from `PUBLIC_APP_URL` / `BETTER_AUTH_URL` (derived from `KAMAL_DEPLOY_HOST`) — there is no `NEXT_PUBLIC_APP_URL`; the browser reaches the API same-origin through the Next reverse-proxy.

| Secret | Default | What it does |
|---|---|---|
| `NEXT_PUBLIC_RAZORPAY_DONATE_LINK` | — | Static Razorpay payment link for donations |
| `NEXT_PUBLIC_ENABLE_CHAI_NUDGE` | `true` (hosted instance) | Show "buy me a chai" prompts. Set `false` for your own self-hosted fork so users never see our donate link. |
| `NEXT_PUBLIC_GITHUB_URL` | — | GitHub link shown on `/open-source` |
| `NEXT_PUBLIC_TWITTER_URL` | — | X / Twitter link shown on `/open-source` |
| `NEXT_PUBLIC_LINKEDIN_URL` | — | LinkedIn link shown on `/open-source` |

### Optional integrations

| Secret | What it is |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | Google Cloud OAuth 2.0 client ID (for Google Sheets integration) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google Cloud OAuth 2.0 client secret |
| `R2_ACCOUNT_ID` | Cloudflare account ID (for file upload field) |
| `R2_ACCESS_KEY_ID` | R2 API token access key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_BUCKET` | R2 bucket name |
| `R2_PUBLIC_BASE_URL` | Public base URL for the bucket, e.g. `https://files.yourdomain.com` |

---

## Secrets & Kamal masking

Kamal **masks every secret value in its log output** (replacing it with `[REDACTED]`). That gives a sharp rule for what goes where, and a couple of traps to avoid:

- **Only true secrets go in `env.secret` (and `.kamal/secrets`).** These are written to an env file on the host and never printed. Public, build-time values — every `NEXT_PUBLIC_*` — are **not** secrets: they're inlined into the client bundle at build and are passed as `builder.args` in `config/deploy.yml`. Listing a public value as a secret is pointless (it ships to the browser anyway) **and** risks the masker redacting that exact string where it legitimately appears in clear log output. (We removed `NEXT_PUBLIC_*` from `env.secret` for this reason — they remain GitHub *secrets* only so the values aren't committed, but Kamal treats them as build args, not runtime secrets.)
- **Don't let a clear variable's value duplicate a secret's value.** Because masking is a literal string replace across all output, a clear var that happens to contain a secret's value will show up `[REDACTED]` and can confuse debugging. Keep secrets high-entropy and distinct (random tokens, not words).
- **Optional secrets must be empty-safe.** Unset optional integrations (`GOOGLE_OAUTH_*`, `R2_*`) are referenced in `.kamal/secrets` as `${VAR:-}`, so an unset one resolves to an empty string and the deploy still succeeds — the feature simply reports "unavailable".
- **`POSTGRES_PASSWORD` must be URL-safe.** It is interpolated into `DATABASE_URL` (`postgres://user:PASSWORD@host/db`), so characters like `@ : / # ? %` or spaces will break the connection string. Generate a safe one with `openssl rand -hex 32` (hex is always URL-safe). This is the most common "a secret value broke the deploy" footgun.

`.kamal/secrets` is committed **by design**: it contains only `$VAR` indirections (no literal values). The real values come from GitHub Environment secrets, which the workflow exports as env vars before `kamal deploy`.

---

## Enabling integrations after deploy

Optional integrations follow a two-step pattern: set env vars + redeploy, then enable in the admin dashboard.

### Enabling Google Sheets

After the env vars are set and the app is redeployed:

1. Log in as an admin user.
2. Dashboard → Admin → Integrations tab.
3. Toggle Google Sheets to **Enabled**.

Form owners can then connect their Google account (Dashboard → Forms → [form] → Integrations → Google Sheets → Connect).

If `GOOGLE_OAUTH_CLIENT_ID` is missing, the admin toggle shows "Configure Google OAuth to enable" and cannot be activated.

### Enabling Discord

Discord requires no global env var — the webhook URL is per-form.

1. Log in as admin, Dashboard → Admin → Integrations → enable Discord.
2. Form owners go to their form builder → Integrations → Discord → paste the webhook URL.

### Enabling file uploads (R2)

After R2 env vars are set and the app is redeployed, the `file_upload` field type automatically appears in the form builder for all users. No admin toggle is needed.

---

## Step-by-step: creating a Google Cloud OAuth client

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create (or pick) a project.
2. **Enable the Sheets API** — APIs & Services → **Library** → search "Google Sheets API" → **Enable**. *(Skipping this is the #1 cause of a 403 on the first row append, even when OAuth itself succeeds.)*
3. **Configure the OAuth consent screen** — APIs & Services → OAuth consent screen:
   - User type: **External**.
   - Add the scope `https://www.googleapis.com/auth/spreadsheets`.
   - **Publishing status matters:** while the app is in **Testing**, only Google accounts you add under **Test users** can connect — anyone else hits `Error 403: access_denied`. Add the email(s) you'll connect with, or click **Publish app** to allow any account.
4. APIs & Services → **Credentials** → Create Credentials → **OAuth client ID** → Application type **Web application**.
5. **Authorised redirect URIs** — add both the ones you'll use:
   - Production: `https://<your-domain>/api/integrations/google/callback`
   - Local dev: `http://localhost:3000/api/integrations/google/callback`
   (The app derives the redirect from `PUBLIC_APP_URL`, which defaults to `http://localhost:3000` locally.)
6. Copy the **Client ID** and **Client Secret**. Locally, put them in `.env` (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`) and run `./setup.sh`; in production add them as GitHub Environment secrets.
7. Restart the API (local) or run `deploy` (prod) so the values are picked up at startup, then Admin → Integrations → enable Google Sheets, and connect your account in Settings.

---

## Step-by-step: creating a Cloudflare R2 bucket + API token

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com) → R2 Object Storage → Create bucket. Note the **bucket name**. Your **Account ID** (`R2_ACCOUNT_ID`) is shown on the R2 overview / Account Home page.
2. R2 → Manage R2 API tokens → Create API token. Permissions: **Object Read & Write** on that bucket. Copy the **Access Key ID** and **Secret Access Key**.
3. For a public base URL (`R2_PUBLIC_BASE_URL`), either enable public access on the bucket (Cloudflare gives a `*.r2.dev` URL) or connect a custom domain under R2 → Settings → Custom Domain.
4. **Configure bucket CORS (required).** The browser uploads files **directly** to a presigned R2 URL from your app's origin, so the bucket must allow cross-origin `PUT`. R2 → your bucket → **Settings → CORS policy** → add:
   ```json
   [
     {
       "AllowedOrigins": ["https://<your-domain>", "http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   *(Without this, the upload PUT fails in the browser with a CORS error even though presigning succeeds. Include `http://localhost:3000` only while testing locally.)*
5. Set the five vars — locally in `.env` then `./setup.sh`; in production as GitHub Environment secrets: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`.
6. Restart the API (local) or run `deploy` (prod). The `file_upload` field type then appears automatically in the builder (no admin toggle).

---

## Security notes & known follow-ups

- **Google OAuth `state` is not signed.** The OAuth callback carries the user id in the `state` parameter to associate the returned tokens with the right account; the callback re-verifies that user exists before storing tokens, but `state` is not an HMAC-signed CSRF nonce. Hardening follow-up: sign `state` (e.g. HMAC with `BETTER_AUTH_SECRET`) and verify it on callback before exchanging the code. Low risk for a single-tenant hosted instance; worth doing before opening Google connect to untrusted users.
- **OAuth tokens & captcha/AI secrets are encrypted at rest** (AES-256-GCM, key derived from `BETTER_AUTH_SECRET` via HKDF). Rotating `BETTER_AUTH_SECRET` makes all of them unreadable — users must reconnect Google / re-enter their AI key. See `/docs/reference/environment/`.
- **Integration delivery is fire-and-forget.** A failing Discord webhook or Sheets append is logged and never blocks (or fails) the form submission.

---

## Kamal config files

| File | Role |
|---|---|
| `config/deploy.yml` | Kamal service definition — image, host, proxy, env, build args, Postgres accessory |
| `.kamal/secrets` | Env-var template (only `$VAR` references, no literal values — safe to commit) |
| `.github/workflows/deploy.yml` | GitHub Actions workflow — all deploy operations |
| `Dockerfile` | Multi-stage build: deps → Next.js build → runtime |
| `scripts/docker-start.sh` | Container entrypoint: starts the API then Next.js |

---

## Pre-deploy checklist

Probe is designed so that **every optional feature degrades gracefully when its keys are absent.** The only secrets that are truly mandatory are the two below; everything else is optional and the app boots and runs core flows without it.

### Minimum required (core works with just these)

- [ ] `DATABASE_URL` — Postgres connection string (in production, composed automatically in `.kamal/secrets` from `POSTGRES_PASSWORD`).
- [ ] `BETTER_AUTH_SECRET` — 32+ char random string (`openssl rand -base64 32`). Also the master key for AES-GCM encryption and the IP-hash salt.
- [ ] `BETTER_AUTH_URL` / `PUBLIC_APP_URL` — the public origin (in production, derived from `KAMAL_DEPLOY_HOST`). They default to `http://localhost:3000`, so local dev needs nothing.

With only those set, **all of these work**: register/login, create/edit/reorder/delete fields, publish/unpublish, fill + submit a public form (`/f/[slug]`), view responses, CSV/Excel/PDF export, endpoint forms (`/submit`), and the admin dashboard.

### Optional (each degrades safely when unset)

| Feature | Key(s) | Behavior when unset |
|---|---|---|
| Rate limiting | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Permissive no-op limiter — site stays up, rate limits off (warns in prod). |
| Email | `RESEND_API_KEY` | `sendEmail()` is a no-op — submissions still store + show in the dashboard. |
| File uploads | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | `file_upload` field hidden in the builder; `uploads.presign` throws `PRECONDITION_FAILED` only if called. Forms without file fields unaffected. |
| Google Sheets | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | Integration reported "unavailable"; admin can't enable; delivery is a no-op. Never throws at boot. |
| Discord | (none — per-form webhook) | Admin-gated; delivery is fire-and-forget. |
| AI generation | (none — per-user BYO Anthropic key) | Builder hides the AI panel; `ai.generateForm` throws `PRECONDITION_FAILED` only if called. |
| Donation nudge | `NEXT_PUBLIC_ENABLE_CHAI_NUDGE`, `NEXT_PUBLIC_RAZORPAY_DONATE_LINK` (build-time) | No nudges shown. |

### Verify "core works with no optional keys"

Before shipping, prove the graceful-degradation contract holds:

1. In a scratch environment set **only** `DATABASE_URL` + `BETTER_AUTH_SECRET` (leave every optional key empty).
2. Boot the API and web app — both should start with **no thrown errors** (rate-limiting / Sheets / R2 just log "unavailable" / "disabled").
3. Register a user, create a form, add/reorder/delete fields, publish it.
4. Open `/f/<slug>`, submit a response — it should save (no email is sent; that's expected).
5. View responses and export CSV / Excel / PDF.
6. Create an endpoint form and POST to `/submit` — the submission stores even with no `RESEND_API_KEY`.
7. Confirm the builder does **not** offer the file-upload field type and Settings does **not** show AI generation until keys are added.

If any of these throw because an optional key is missing, that's a bug — optional features must never break a core path.

---

## Health check

Kamal polls `GET /health` every 5 seconds with a 3-second timeout. The route returns `200 OK` when the Next.js server is up. The app is only promoted to live traffic once the health check passes.

---

## Notes on `drizzle-kit push` vs migrations

The current setup uses `pnpm db:push` (via the `migrate` action), which drops and recreates schema objects. This is appropriate for early-stage development. Before onboarding real users with production data you care about, switch to `drizzle-kit generate` + committed SQL migration files run at container start.

---

— *Probe is based on [ChaiForm](https://github.com/developedbysaad) by Saad (MIT).*
