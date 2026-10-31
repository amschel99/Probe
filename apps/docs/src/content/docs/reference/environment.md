---
title: Environment variables
description: Every Probe environment variable, what it does, its default, and what happens when it is unset.
---

`.env.example` at the repo root is the annotated template. Locally, copy it to `.env` and run `./setup.sh`. On Railway, set variables on the Probe service. See [Deployment](/docs/guides/deployment/).

Scope:

- **Server** variables are read when the processes start. Change them and restart.
- **Build** variables (`NEXT_PUBLIC_*`) are baked into the browser bundle when Next.js builds. Change them and rebuild. They ship to every browser, so never put secrets in them.

Blank values are treated as unset for the optional integrations and AI variables.

## Required

| Variable | Scope | Default | What it does |
|---|---|---|---|
| `DATABASE_URL` | server | none | Postgres connection string. On Railway, the reference `${{Postgres.DATABASE_URL}}`. Locally, `postgres://probe:probe_local@localhost:5434/probe_dev`. |
| `BETTER_AUTH_SECRET` | server | none | At least 32 characters. Generate with `openssl rand -base64 32`. Signs sessions, is the key for encrypted secrets (captcha secrets, AI keys, Google tokens) and salts IP hashes. Changing it signs everyone out and makes stored secrets unreadable. |
| `BETTER_AUTH_URL` | server | `http://localhost:3000` | The public origin, such as `https://probe.jahazi.city`. Sign-in redirects are checked against it. |
| `PUBLIC_APP_URL` | server | `http://localhost:3000` | The public origin again. Email links, the password-reset link, the Google OAuth redirect and the OpenAPI server URL are built from it. Keep it equal to `BETTER_AUTH_URL`. |
| `NODE_ENV` | server | `development` | Set `production` in production. It turns on secure cookies and turns off development CORS. The Docker image sets it. |

The defaults for `BETTER_AUTH_URL` and `PUBLIC_APP_URL` only suit local development. In production, set both.

## Core, optional

| Variable | Scope | Default | What it does |
|---|---|---|---|
| `PORT` | server | `3000` | Port the web app listens on. Railway sets it. The API always uses 8000 inside the container. |
| `API_INTERNAL_URL` | server | `http://localhost:8000` | Where the web app reaches the API. The default is right for the single container. |
| `WEB_ORIGIN` | server | `http://localhost:3000` | Origin allowed by CORS in development only. Ignored in production. |
| `COOKIE_DOMAIN` | server | unset | Share the session cookie across subdomains, such as `.example.com`. Leave unset unless you need it. |
| `LOGGER_LEVEL` | server | per `NODE_ENV` | `error`, `info` or `debug`. |
| `NEXT_PUBLIC_API_URL` | build | unset | Where the browser sends tRPC calls. Set `http://localhost:8000/trpc` for local development. Do not set it in production. |

## Email

| Variable | Scope | Default | What it does |
|---|---|---|---|
| `RESEND_API_KEY` | server | unset | [Resend](https://resend.com) API key. Sends endpoint-form verification, response notifications, confirmation emails and password resets. Unset: nothing is sent, and verification and reset links are printed in the server logs. |
| `RESEND_FROM` | server | `Probe <noreply@riftfi.com>` | The From address. It must be on a domain you have verified in Resend. Change it. |

## AI form generation

These set an instance-wide default so every user can generate forms without their own key. A user's own key, saved in **Settings → AI form generation**, always wins. See [AI form generation](/docs/guides/ai-generation/).

| Variable | Scope | Default | What it does |
|---|---|---|---|
| `AI_PROVIDER` | server | unset | `anthropic`, `openai`, `deepseek`, `gemini`, `openrouter`, `groq`, `mistral` or `custom`. Unset: only users with their own key can generate. |
| `AI_API_KEY` | server | unset | The provider's key. Required, except for `custom`. |
| `AI_MODEL` | server | provider default | The model. Required for `custom`. |
| `AI_BASE_URL` | server | unset | OpenAI-compatible base URL. Only used by `custom`, such as `http://localhost:11434/v1`. |

## Rate limiting

| Variable | Scope | Default | What it does |
|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` | server | unset | Upstash Redis REST URL. |
| `UPSTASH_REDIS_REST_TOKEN` | server | unset | Upstash Redis REST token. |

Rate limiting is always on. Without Upstash, counters are kept in memory. That is fine for one container. They reset on restart and are not shared between replicas. Set Upstash if you run more than one.

The limits are 5 submissions per form per IP per hour, for both hosted and endpoint forms, and 60 analytics events per IP per minute. Sign-in and password-reset requests are limited separately by Better Auth's built-in limiter, which does not use Upstash.

## File uploads (Cloudflare R2)

All five are needed. If any is missing, the file upload field is disabled in the builder. Other fields are not affected.

| Variable | Scope | What it does |
|---|---|---|
| `R2_ACCOUNT_ID` | server | Cloudflare account ID. |
| `R2_ACCESS_KEY_ID` | server | R2 API token access key ID. |
| `R2_SECRET_ACCESS_KEY` | server | R2 API token secret. |
| `R2_BUCKET` | server | Bucket name. |
| `R2_PUBLIC_BASE_URL` | server | Public URL of the bucket, used for download links. |

## Google Sheets

| Variable | Scope | What it does |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | server | OAuth client ID of a Google Cloud web application. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | server | Its client secret. |

The redirect URI is `${PUBLIC_APP_URL}/api/integrations/google/callback`. Unset: the integration shows as unavailable and admins cannot enable it. Discord needs no variables.

## Captcha verify URLs

Captcha secret keys are entered per endpoint form in the dashboard and stored encrypted. They are not environment variables. These only change where tokens are verified.

| Variable | Default |
|---|---|
| `HCAPTCHA_VERIFY_URL` | `https://hcaptcha.com/siteverify` |
| `RECAPTCHA_VERIFY_URL` | `https://www.google.com/recaptcha/api/siteverify` |
| `TURNSTILE_VERIFY_URL` | `https://challenges.cloudflare.com/turnstile/v0/siteverify` |

## Optional extras

| Variable | Scope | Default | What it does |
|---|---|---|---|
| `NEXT_PUBLIC_GITHUB_URL` | build | unset | GitHub link on `/open-source`. |
| `NEXT_PUBLIC_TWITTER_URL` | build | unset | X link on `/open-source`. |
| `NEXT_PUBLIC_LINKEDIN_URL` | build | unset | LinkedIn link on `/open-source`. |
| `NEXT_PUBLIC_ENABLE_CHAI_NUDGE` | build | `false` | Shows a donation prompt in the dashboard. Off unless set to `true` and `NEXT_PUBLIC_RAZORPAY_DONATE_LINK` is set. Leave it off. |
| `NEXT_PUBLIC_RAZORPAY_DONATE_LINK` | build | unset | The link that prompt uses. |

The Kamal setup also reads deploy-only variables such as `KAMAL_SERVER_HOST` and `POSTGRES_PASSWORD`. They are not read by the app. See `config/deploy.yml` and `.kamal/secrets` if you use it.
