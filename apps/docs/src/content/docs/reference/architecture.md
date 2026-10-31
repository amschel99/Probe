---
title: Architecture
description: How Probe is built. The container, the request flow, auth, API keys, AI providers, link previews, and where data lives.
---

This page explains how Probe fits together: the monorepo, the container, how a request flows, and where data lives.

## Deployment shape

```text
Browser ──HTTPS──▶ Railway edge (TLS, your domain)
                        │
                        ▼
        ┌──────────── one container ─────────────┐
        │  web   Next.js on $PORT                 │
        │    pages, /f/<slug>, link previews      │
        │    proxies /trpc, /api/auth, /submit,   │
        │    /docs, /api/docs, /openapi.json,     │
        │    /forms/<id>/export.* ─────┐          │
        │                              ▼          │
        │  api   Express on :8000                 │
        │    tRPC, Better Auth, /submit, exports  │
        └──────────────────┬──────────────────────┘
                           ▼
                Postgres (separate Railway service)
```

| Layer | What is there |
|---|---|
| Edge | Railway terminates TLS for your domain and routes to the container's `$PORT`. |
| Container | One image built from the `Dockerfile`. `scripts/docker-start.sh` runs the API and the web app. If either exits, the container exits and Railway restarts it. |
| Database | Postgres as its own Railway service, reached through `DATABASE_URL`. |
| Health | `GET /health` is proxied from the web app to the API, so a pass means both are up. It does not touch the database. |
| Origin | Single origin. The browser only ever talks to the web app. There is no CORS for first-party calls in production. |

On boot the schema is applied in the background: `drizzle-kit push`, then `db:ensure`, then `db:themes`, retried for about two minutes. See [What happens on boot](/docs/guides/deployment/#what-happens-on-boot).

## Repo layout

```text
apps/
  web/          Next.js App Router: marketing, auth, dashboard, /f/<slug>
  api/          Express server: tRPC, Better Auth, /submit, exports, docs
  docs/         This site (Astro + Starlight), built to static files
packages/
  database/     Drizzle schema (models/), seed, themes, ensure-schema, reset-password
  trpc/         tRPC routers, Better Auth config, API keys, AI providers, client
  services/     Email, rate limiting, captcha, crypto, IP hashing, storage,
                integrations, validators (Zod)
  logger/       Shared logger
scripts/
  docker-start.sh   Container entrypoint
```

The web app reaches the API through Next.js rewrites to `API_INTERNAL_URL` (`http://localhost:8000` in the container). The API serves the built docs at `/docs` and the Scalar API reference at `/api/docs`.

## Request flow

The API mounts, in order:

```text
/api/auth/*              Better Auth (before body parsing; needs the raw body)
/submit                  endpoint-form handler (reads its own capped body)
/health
/verify-access-key/:t    recipient verification
/api/integrations/google/callback
/forms/:id/export.:fmt   CSV, XLSX, PDF
/openapi.json, /api/docs
/docs                    static Starlight build
/api/*                   REST mapping of tRPC procedures (trpc-to-openapi)
/trpc/*                  tRPC
```

A tRPC call goes through:

```text
createContext(req)
  → browser session cookie, or API key header
  → procedure: public, protected (session or key), session-only, or admin
  → Zod input validation
  → ownership check (forms, fields, responses)
  → Drizzle query
  → superjson response
```

## Authentication

Better Auth handles accounts and sessions, stored in Postgres through the Drizzle adapter.

| What | How |
|---|---|
| Sign-in | Email and password. Minimum 8 characters. bcrypt, cost 10. |
| Session cookie | Prefix `probe`. `HttpOnly`, `Secure` in production. Host-only unless `COOKIE_DOMAIN` is set. |
| Session length | 7 days, refreshed once a day of use. |
| First account | Becomes `admin` on a fresh instance. |
| Password reset | A one-hour link to `/reset-password`. Emailed, or logged if email is off. Resetting revokes every session. |
| Trusted origins | The origins of `BETTER_AUTH_URL` and `PUBLIC_APP_URL`. |
| Dashboard guard | `middleware.ts` redirects `/dashboard/*` to `/login` without a session cookie. The server checks the session on every call. |

### API keys

Users create personal keys in **Settings → API keys**. A key is `probe_` plus random bytes. Only its SHA-256 hash is stored, with a prefix for display and a last-used time. A key is shown once.

Requests send it as `Authorization: Bearer probe_…` or `X-API-Key`. The context resolves the key to its owner, so a key can do whatever its owner can, except manage API keys. Those procedures need a browser session. Export URLs accept a key too.

See [API and agents](/docs/guides/api-and-agents/).

## Authorization

Every procedure on forms, fields and responses checks that the caller owns the form. A form you do not own returns `NOT_FOUND`, not `FORBIDDEN`, so callers cannot tell whether it exists. Admin procedures also check the `admin` role.

## Public form checks

`public.getForm` runs these checks in order for `/f/<slug>`:

```text
form exists and is a hosted form?   no  → NOT_FOUND
status is published?                no  → NOT_FOUND (drafts stay hidden)
expiresAt in the past?              yes → PRECONDITION_FAILED "Form has closed"
responseCount ≥ maxResponses?       yes → PRECONDITION_FAILED "Form is full"
password set?                       yes → ask for it; bcrypt compare; wrong → FORBIDDEN
→ form, fields, theme
```

`public.submitResponse` repeats the same checks, applies the rate limit, then validates the answers against the form's fields. Fields hidden by conditional logic are not required.

Unlisted forms are reachable by link. Only public forms appear on `/explore`.

## Endpoint forms

`POST /submit` reads at most 64 KB and 50 keys. It looks up the access key, checks the origin allowlist (or the server-side opt-in when there is no `Origin` or `Referer`), applies the rate limit, the honeypot and the captcha, then stores the submission.

Discord and Sheets forwarding runs for every stored submission. Email and the signed webhook only run once the recipient email is verified. The webhook body is signed with HMAC-SHA256 and sent as `X-Probe-Signature: sha256=<hex>`.

See [Endpoint forms](/docs/guides/endpoint-forms/).

## Rate limiting

| Limiter | Key | Limit |
|---|---|---|
| Submissions | form + IP | 5 per hour |
| Analytics events | IP | 60 per minute |

They apply to hosted and endpoint submissions. With Upstash configured, counters live in Redis. Without it, they live in process memory, which is enough for one container. Rate-limited `/submit` responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`.

Better Auth limits its own sign-in and reset endpoints separately.

## Secrets and privacy

- **Encryption.** Captcha secrets, AI keys and Google tokens are encrypted with AES-256-GCM. The key is derived from `BETTER_AUTH_SECRET` with HKDF-SHA256. Rotating the secret makes them unreadable.
- **IP addresses.** Raw IPs are never stored. Probe stores `SHA-256(ip + secret)` for rate-limit keys and duplicate detection. It is never shown in the dashboard.
- **Headers.** Every page sends `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy` that blocks camera, microphone and location. Everything except `/f/*` sends `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'`. Hosted forms send `frame-ancestors *` so they can be embedded anywhere.

## AI providers

`packages/trpc/server/ai/providers.ts` lists the providers and their default models. Anthropic goes through its SDK. Every other provider, including custom endpoints, goes through one OpenAI-compatible chat-completions client.

A request is configured from the user's own saved provider first, then the instance's `AI_*` variables. Keys are checked against the provider before saving. The model returns JSON matching a fixed schema of title, description and fields. Probe validates it, creates an unlisted draft form, and returns its ID.

Custom base URLs are admin-only, because they make the server call an arbitrary address.

See [AI form generation](/docs/guides/ai-generation/).

## Link previews

Each `/f/<slug>` page sets Open Graph and Twitter card metadata from the form's title and description. `opengraph-image.tsx` renders a 1200 by 630 PNG with Next.js `ImageResponse`, using fonts committed in `apps/web/assets/og`. WhatsApp, Slack, X and iMessage show it when the link is pasted. The Share tab previews the same card next to the WhatsApp message.

## Database

One Postgres database, managed with Drizzle. Each table has its own file in `packages/database/models/`.

| Table | Holds |
|---|---|
| `users`, `sessions`, `accounts`, `verification` | Better Auth accounts and sessions. `users` also holds the role and the encrypted AI settings. |
| `api_keys` | Hashed personal API keys. |
| `themes` | Built-in themes. `config` is JSON: colors, fonts, radius. |
| `forms` | Hosted and endpoint forms: status, visibility, settings, limits, access key, endpoint settings. |
| `fields` | Field definitions, ordered, with config and conditional logic. |
| `responses` | One row per submission. Endpoint submissions keep their `payload` here. |
| `response_values` | One row per answer for hosted forms. |
| `analytics_events` | Append-only view, start, submit and abandon events. |
| `access_key_verifications`, `endpoint_audit` | Endpoint-form verification tokens and audit log. |
| `form_integrations`, `google_connections`, `platform_settings` | Per-form Discord and Sheets settings, Google tokens, and admin switches. |

Deleting a form cascades to its fields, responses, answers and events. `forms.response_count` is updated in the same transaction as each submission.

The schema is applied with `drizzle-kit push`, plus `ensure-schema.ts` for additions that must exist. There are no migration files yet.

## Analytics

Events are appended as respondents view, start, submit and abandon a form. The dashboard counts them at read time. It shows views, starts, completions, completion rate, average completion time, a 30-day submission chart, and the top drop-off field.

## Themes

A theme is data: a row in `themes` with colors, fonts and radius. The renderer applies it as CSS custom properties on the form, so switching themes needs no extra JavaScript. `pnpm db:themes` upserts the 11 built-in themes, including Paper.

## Integrations

Discord and Google Sheets each have two switches:

| State | Condition |
|---|---|
| Unavailable | Required variables missing. Sheets needs the Google OAuth client. Discord needs none. |
| Available, off | An admin has not enabled it. |
| Enabled | An admin enabled it in **Admin → Integrations**. Owners can set it up per form. |

Delivery runs after the submission is stored and never blocks it. Failures are logged.

## File uploads

The file upload field uses Cloudflare R2. The browser asks the API for a presigned URL, uploads straight to R2, and stores the resulting public URL as the answer. Files never pass through the Probe server. Without all five `R2_*` variables, the field is disabled. Endpoint forms do not take files.

## Credits

Probe started from the MIT-licensed ChaiForm project.
