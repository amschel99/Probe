---
title: "Environment Variables"
description: "Every Probe environment variable: scope, required/optional, and what it gates."
---

Complete reference for every environment variable in Probe.

**Scope key:**

| Symbol | Meaning |
|---|---|
| `server` | Read by the API / server-side Next.js code at runtime |
| `build` | `NEXT_PUBLIC_*` — inlined into the client JS bundle at `next build` time. Changing these requires a **rebuild** (a new `deploy`, not just `redeploy`). Never put secrets here. |

`.env.example` in the repo root is the canonical annotated template. Copy it to `.env`, run `./setup.sh` (symlinks it into each package), and the apps pick it up.

---

## Core

| Variable | Scope | Required | Default | Notes |
|---|---|---|---|---|
| `NODE_ENV` | server | no | `development` | Set to `production` automatically by Kamal |
| `PORT` | server | no | `3000` | Port the Next.js (web) app listens on |
| `API_INTERNAL_URL` | server | no | `http://localhost:8000` | URL the web app uses to reach the API server-to-server. In the single-container production setup both apps share a host, so the default works as-is. |
| `DATABASE_URL` | server | **yes** | `postgres://probe:probe_local@localhost:5434/probe_dev` | Postgres connection string. In production, composed in `.kamal/secrets` from the Postgres accessory credentials — do not set it as a separate GitHub secret. |
| `BETTER_AUTH_SECRET` | server | **yes** | — | 32+ char random string. Serves three purposes: (1) Better Auth session signing, (2) HKDF master key for AES-256-GCM encryption of captcha secrets and Anthropic API keys, (3) SHA-256 salt for IP hashing. **Rotating this secret logs everyone out, invalidates all stored IP hashes, and makes all AES-GCM-encrypted fields unreadable (captcha secrets and AI keys must be re-entered).** Generate: `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | server | **yes** | `http://localhost:3000` | The app's own public origin. Cookies and email verification links are built from this. Must match the actual domain in production. |
| `PUBLIC_APP_URL` | server | no | `http://localhost:3000` | Used by the API for absolute URLs in API specs, verification links, notification-email links, and the Google OAuth redirect URI. Keep equal to `BETTER_AUTH_URL`. In production, Kamal derives this automatically from `KAMAL_DEPLOY_HOST`. |
| `WEB_ORIGIN` | server | no | `http://localhost:3000` | Origin the API reflects in CORS headers **in non-production only** (local dev convenience). In production the `/trpc` and `/api/auth` CORS middleware is skipped entirely because the deploy is single-origin, so this value is ignored there. |
| `LOGGER_LEVEL` | server | no | per `NODE_ENV` | Optional `@repo/logger` verbosity: `error`, `info`, or `debug`. Unset → the logger chooses a sensible default for the current `NODE_ENV`. |

---

## AI form generation (no env var)

AI form generation is **bring-your-own-key, per user** — there is no server-wide AI environment variable.

Each user pastes their own Anthropic API key in **Dashboard → Settings**. The key is validated with a live auth probe, then stored AES-256-GCM encrypted in `users.ai_api_key_enc` (the encryption key is derived from `BETTER_AUTH_SECRET`). Charges go to that user's own Anthropic account.

With no key saved, the builder hides the AI generation panel, and `ai.generateForm` throws `PRECONDITION_FAILED` only if it is somehow called. No deployment configuration is required for or against this feature.

---

## Rate limiting

| Variable | Scope | Required | Default | Notes |
|---|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` | server | no | — | Upstash Redis REST URL. Get from [console.upstash.com](https://console.upstash.com) → create Redis DB → REST. |
| `UPSTASH_REDIS_REST_TOKEN` | server | no | — | Upstash Redis REST token. |

If both are unset, all three rate limiters (`submitLimiter`, `eventLimiter`, `authLimiter`) degrade to a permissive no-op. The site stays up, but submission and auth rate limits are off. A warning is logged in dev; an error is logged in production.

---

## Email

| Variable | Scope | Required | Default | Notes |
|---|---|---|---|---|
| `RESEND_API_KEY` | server | no | — | Resend API key from [resend.com](https://resend.com) → API Keys. Verify your sending domain so the `From` address passes SPF/DKIM. If unset, `sendEmail()` is a no-op — submissions are stored and visible in the dashboard, just not emailed. |
| `RESEND_FROM` | server | no | `Probe <noreply@riftfi.com>` | Must be on a Resend-verified domain in production. |

---

## Captcha verify endpoints

| Variable | Scope | Required | Default | Notes |
|---|---|---|---|---|
| `HCAPTCHA_VERIFY_URL` | server | no | `https://hcaptcha.com/siteverify` | Only override for self-hosted / enterprise hCaptcha. The hCaptcha **secret key** is entered per-form in the dashboard and stored AES-GCM encrypted — it is not an env var. |
| `RECAPTCHA_VERIFY_URL` | server | no | `https://www.google.com/recaptcha/api/siteverify` | Only override for self-hosted reCAPTCHA. The reCAPTCHA **secret key** is entered per-form and stored AES-GCM encrypted — it is not an env var. |

---

## Google Sheets integration

| Variable | Scope | Required | Default | Notes |
|---|---|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | server | no | — | Google Cloud OAuth 2.0 client ID. Required for the Google Sheets integration. If unset, the admin toggle shows "Configure Google OAuth to enable" and the integration cannot be activated. Redirect URI must be `https://<domain>/api/integrations/google/callback`. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | server | no | — | Google Cloud OAuth 2.0 client secret. Required alongside `GOOGLE_OAUTH_CLIENT_ID`. |

---

## File uploads (Cloudflare R2)

| Variable | Scope | Required | Default | Notes |
|---|---|---|---|---|
| `R2_ACCOUNT_ID` | server | no | — | Cloudflare account ID. Found in the Cloudflare dashboard under Account Home. |
| `R2_ACCESS_KEY_ID` | server | no | — | R2 API token access key ID (from R2 → Manage R2 API Tokens). |
| `R2_SECRET_ACCESS_KEY` | server | no | — | R2 API token secret. |
| `R2_BUCKET` | server | no | — | R2 bucket name. |
| `R2_PUBLIC_BASE_URL` | server | no | — | Public base URL for the bucket, e.g. `https://files.yourdomain.com`. Used to construct public URLs for uploaded files. |

If any of the five R2 variables are unset, the `file_upload` field type is hidden in the form builder with the message "Configure R2 storage to enable file uploads". All other field types and existing forms are unaffected.

---

## Client-side (NEXT_PUBLIC_*) — build-time baked

> These values are injected into the JavaScript bundle during `next build`. They are **not** read at container startup. To change them in production you must run a new `deploy` (which triggers a rebuild), not `redeploy`.
>
> `NEXT_PUBLIC_*` variables ship to every browser that loads the app. Never put secrets, API keys, or anything sensitive here.

| Variable | Scope | Required | Default | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | build | no | — | Where the browser sends tRPC calls. In local dev, set to `http://localhost:8000/trpc` to hit the API directly. In production, leave **unset** — the browser calls the same-origin `/trpc` path and the Next.js app reverse-proxies it to the API. Setting this in production would break the single-origin pattern. |
| `NEXT_PUBLIC_RAZORPAY_DONATE_LINK` | build | no | — | Static Razorpay payment link for the donation flow (no key or secret needed). Create one in the Razorpay dashboard → Payment Links. Only relevant when `NEXT_PUBLIC_ENABLE_CHAI_NUDGE=true`. |
| `NEXT_PUBLIC_ENABLE_CHAI_NUDGE` | build | no | `false` | Set `true` to show contextual "buy me a chai" prompts in the dashboard footer and after publish/export actions. The hosted instance sets this to `true`; self-hosters should leave it `false` so their users never see a donate link pointing at someone else's Razorpay account. |
| `NEXT_PUBLIC_GITHUB_URL` | build | no | — | GitHub repo URL shown on the `/open-source` page. |
| `NEXT_PUBLIC_TWITTER_URL` | build | no | — | X / Twitter profile URL shown on `/open-source`. |
| `NEXT_PUBLIC_LINKEDIN_URL` | build | no | — | LinkedIn profile URL shown on `/open-source`. |

---

## Kamal / deploy (not app env vars)

These are used by the GitHub Actions workflow and Kamal, not by the running app.

| Variable | Where set | Notes |
|---|---|---|
| `KAMAL_REGISTRY_USERNAME` | GitHub secret | Docker Hub username |
| `KAMAL_REGISTRY_PASSWORD` | GitHub secret | Docker Hub PAT (`dckr_pat_…`) |
| `KAMAL_SERVER_HOST` | GitHub secret | IP or hostname of the VPS |
| `KAMAL_DEPLOY_HOST` | GitHub secret | Public domain. Drives TLS, `BETTER_AUTH_URL`, `PUBLIC_APP_URL`. |
| `POSTGRES_PASSWORD` | GitHub secret | Password for the Postgres accessory. Also used when composing `DATABASE_URL` in `.kamal/secrets`. |
| `SSH_PRIVATE_KEY` | GitHub secret | Private key for SSH access to the deploy host |
| `KAMAL_SERVICE` | GitHub variable (optional) | Service name, default `probe` |
| `KAMAL_IMAGE` | GitHub variable (optional) | Full image name override |
| `APP_PORT` | GitHub variable (optional) | Container port, default `3000` |
| `POSTGRES_USER` | GitHub variable (optional) | Postgres user, default `probe` |
| `POSTGRES_DB` | GitHub variable (optional) | Postgres database name, default `probe_production` |
| `RESEND_FROM` | GitHub variable (optional) | Sender address, default `Probe <noreply@riftfi.com>` |

---

— *Probe is based on [ChaiForm](https://github.com/developedbysaad) by Saad (MIT).*
