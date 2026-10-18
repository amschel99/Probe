---
title: "Architecture"
description: "How Probe is built: request lifecycle, auth, integrations, uploads, and more."
---

How Probe is put together: the monorepo, the request flow, the auth model, and the way it ships.

---

## High-level

```
┌──────────────┐    ┌──────────────────────────────────────┐    ┌──────────┐
│   Browser    │ ⇄ HTTP /, /api/trpc/*, /api/auth/*, etc. ⇄ │   Next.js   │ ⇄ │ Postgres │
│ React + RSC  │                                            │   process   │   └──────────┘
└──────────────┘                                            │   + Hono    │
                                                            │   mount     │
                                                            └─────────────┘
```

In **dev**: `next dev` serves both pages and API routes on `:3000`. Browser sees one origin.

In **prod**: `next start` serves the SPA pages, RSC payloads, and API routes (which dispatch into Hono) — same origin, same port, same process.

## Deployment shape at a glance

| Layer       | What's there                                                            |
| ----------- | ----------------------------------------------------------------------- |
| DNS         | One A record → `probe.riftfi.com`                         |
| TLS + proxy | `kamal-proxy` on the host; Let's Encrypt cert; routes by `Host:` header |
| Container   | One Docker image. One Node process. Next.js on port 3000.              |
| Inside it   | Next.js pages + `/api/[[...path]]` catch-all forwards to Hono           |
| DB          | Neon (serverless Postgres) over HTTPS, or a `postgres:17` accessory     |
| CORS        | None for first-party calls — single origin. CORS only on `/api/submit` (public endpoint forms surface). |
| Cookies     | `sameSite: lax`, `secure: true` in prod, set by Better Auth             |

This is the single-origin pattern: one DNS record, one TLS cert, one container, one origin. Browser fetches `/api/trpc/forms.list` and the same Next.js process resolves it via the Hono mount. No second port. No `SameSite: none` cross-origin gymnastics for first-party calls.

## Repo layout

```
probe/
├── apps/
│   └── web/                         Next.js 14 App Router
│       ├── app/
│       │   ├── (marketing)/          /, /open-source, /explore, /templates, /docs
│       │   ├── (auth)/               /login, /register
│       │   ├── dashboard/            protected creator surface
│       │   ├── f/[slug]/             public hosted-form fill + success/closed/locked screens
│       │   └── api/
│       │       └── [[...path]]/      catch-all → Hono.fetch(req)
│       ├── middleware.ts             session check → /login redirect
│       └── next.config.mjs
│
├── packages/
│   ├── db/                          Drizzle + Neon · schema · seed · types
│   ├── validators/                  Zod schemas — single source of truth
│   ├── server/                      Hono app · tRPC routers · Better Auth · rate limiter
│   ├── trpc-client/                 typed React hooks (tRPC v11 + TanStack Query)
│   ├── ui/                          shadcn/ui + custom components
│   └── email/                       Resend wrapper + React Email templates
│
├── Dockerfile                       multi-stage; one image
├── config/deploy.yml                Kamal — service, proxy, db accessory
├── turbo.json
└── pnpm-workspace.yaml
```

`packages/server` is a **library**, not a server. It exports the Hono `app`, the tRPC `appRouter` type, the Better Auth instance, and helpers. The web app's catch-all route handler is the only place that calls `serve()`-style boot logic, and it does so by delegating each incoming request to `app.fetch(req)`.

## Request lifecycle

Every request hitting `/api/*` flows through the same chain:

```
Next.js route handler  (/api/[[...path]]/route.ts)
   → Hono app.fetch(req)
   → secureHeaders()
   → cors()  (only enabled on /submit; first-party routes don't need it)
   → logger()
   → branch:
       /auth/*    → auth.handler(req.raw)             (Better Auth)
       /trpc/*    → trpcServer({ router, createContext })
       /submit    → endpoint-form submission handler  (public + rate-limited)
       /docs      → Scalar UI
       /openapi.json → hand-rolled spec
```

For **tRPC procedures** the inner chain is:

```
createContext(req)
   → session lookup (Better Auth cookie)
   → procedure.input(zod).query/mutation(handler)
   → ownership guard (forms / fields / responses procedures)
   → Drizzle query
   → JSON (superjson-encoded) response
```

## Authentication

Better Auth owns sessions and persists them in the same Postgres database via the Drizzle adapter. The `users` and `sessions` tables are in `packages/db` and Better Auth is wired to them.

| Surface              | Mechanism                                                          |
| -------------------- | ------------------------------------------------------------------ |
| Email + password     | Better Auth `emailAndPassword` — bcrypt cost 12, autoSignIn enabled |
| Session cookie       | `probe.session_token`, `HttpOnly`, `SameSite: lax`, `Secure` in prod |
| Session length       | 7-day sliding window, refreshed on activity                       |
| Logout               | DELETE `/api/auth/sign-out` clears the row + cookie                |
| Server-side guard    | tRPC `protectedProcedure` reads ctx.user; throws `UNAUTHORIZED`    |
| Next.js middleware   | `middleware.ts` consults the session cookie and redirects to `/login` for `/dashboard/*` |

There is no JWT, no refresh token, no localStorage-stored auth state. Cookies do all the work. Same single-origin advantage as everything else — the cookie is set by the same host that reads it.

## Authorization (ownership guard)

Every mutation on `forms`, `fields`, `responses` calls `assertFormOwner(db, formId, userId)` before touching data. The guard returns `NOT_FOUND` (intentionally — not `FORBIDDEN`) when the resource exists but isn't owned by the caller, so a probe can't distinguish "doesn't exist" from "you can't see it".

## Public form guard chain (`/api/trpc/public.getForm`)

For the public renderer at `/f/[slug]`, the loader runs this chain in order, failing fast:

```
form in DB?                           No  → NOT_FOUND
status === "published"?              No  → NOT_FOUND  (don't reveal drafts exist)
expiresAt < now?                     Yes → PRECONDITION_FAILED "Form has closed"
responseCount >= maxResponses?       Yes → PRECONDITION_FAILED "Form is full"
settings.passwordHash set?           Yes → return { passwordRequired: true }
                                            client renders gate, posts attempt
                                            server bcrypt.compare; wrong → FORBIDDEN
→ sanitized form + fields ✓
```

`visibility === "unlisted"` doesn't block direct access — it only excludes the form from `/explore` listings. Listings use:

```sql
WHERE status = 'published' AND visibility = 'public'
```

`getForm` doesn't check visibility because someone with the link is allowed to view it. The listing query is the only gatekeeper for `unlisted`.

## CSRF

Better Auth ships double-submit CSRF protection for its own endpoints. tRPC mutations rely on the same-origin cookie + `Origin` header check, plus a custom `x-trpc-source: web` header that the tRPC client sets — a cross-origin attacker can't set custom headers without a CORS preflight that we never grant.

For first-party calls this is sufficient. For the public **endpoint-forms** `/api/submit` route (which intentionally accepts cross-origin POSTs from any allowed origin), see the dedicated security model in `plan/todo.md`.

## Rate limiting

Upstash Redis (sliding window) with three named limiters in `packages/server/src/lib/ratelimit.ts`:

| Limiter        | Key                                  | Limit         |
| -------------- | ------------------------------------ | ------------- |
| `submitLimiter` | `submit:${formId}:${ip}`             | 5 / 1 hour    |
| `eventLimiter`  | `event:${ip}`                        | 60 / 1 minute |
| `authLimiter`   | `auth:${ip}`                         | 10 / 5 minutes |

If `UPSTASH_REDIS_REST_URL` is unset in dev, the limiter degrades to a permissive no-op (logs a warning). In prod, missing config logs an error and falls back to permissive — so a misconfigured Upstash never takes the site down, just removes the protection.

`X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` are returned on every rate-limited response.

## Security headers

`secureHeaders()` middleware applies the standard set; `next.config.mjs` adds the rest at the framework layer:

| Header                            | Value                                  |
| --------------------------------- | -------------------------------------- |
| `X-Frame-Options`                 | `SAMEORIGIN`                            |
| `X-Content-Type-Options`          | `nosniff`                               |
| `Referrer-Policy`                 | `strict-origin-when-cross-origin`       |
| `Permissions-Policy`              | `camera=(), microphone=(), geolocation=()` |
| `Strict-Transport-Security`       | `max-age=15552000; includeSubDomains` (prod only) |
| `Content-Security-Policy`         | self + Google Fonts + Razorpay link host |

Embedding the public form via iframe is supported on a per-form basis via a future `embedAllowed` setting; that flow will downgrade `X-Frame-Options` to `ALLOWALL` for the embed route only.

## IP handling

Raw client IPs are **never** persisted. The helper in `packages/server/src/lib/ip.ts` reads `x-forwarded-for` / `cf-connecting-ip` / `x-real-ip`, hashes the result with `SHA-256(ip + BETTER_AUTH_SECRET)`, and stores the hash on `responses.ipHash`. Rotating `BETTER_AUTH_SECRET` invalidates all hashes.

The hash is used for ballot-stuffing heuristics and rate limit keys only — never surfaced in the dashboard UI.

## Validation

All Zod schemas live in `packages/validators` and are imported by both server and client. There is exactly one definition per shape — DB types come from Drizzle, API types come from Zod, frontend form types come from both. No drift.

The two interesting ones:

- `buildResponseSchema(fields)` — constructs a Zod object at runtime from the form's actual field definitions. Used on the server in `public.submitResponse` and on the client for inline validation. Conditional-logic-hidden fields are not required even if `field.required === true`.
- `formSettingsSchema` — full FormSettings shape (used on read); `updateFormSettingsSchema` omits `passwordHash` and is `.partial()` (used on write — password set via dedicated `setPassword` mutation that bcrypts server-side).

## Database

Single Postgres database. Drizzle ORM. Schema split into one file per table under `packages/db/src/schema/`.

| Table              | Purpose                                                          |
| ------------------ | ---------------------------------------------------------------- |
| `users`            | Account + bcrypt hash. Better Auth owns the column shape.        |
| `sessions`         | Better Auth — token, expiry, IP, UA.                             |
| `themes`           | 10 seeded built-in themes + custom (future). `config` is jsonb.  |
| `forms`            | One row per form. `status`/`visibility`/`settings` columns; jsonb settings. |
| `fields`           | Field definitions. Cascades on form delete.                     |
| `responses`        | One row per submission. `ipHash` only. Cascades on form delete.  |
| `response_values`  | One row per (response, field). `value` is jsonb (string/number/array/bool). |
| `analytics_events` | Append-only `view`/`start`/`submit`/`abandon`. Cascades.         |

`ON DELETE CASCADE` is everywhere — deleting a form removes its fields, responses, response values, and analytics events in one statement. Application code does a single `.delete()` and trusts the cascade.

`responses.response_count` is materialized on the parent `forms` row, incremented in the same transaction as the submission. Lets explore/list views render without a count query per form.

## Analytics

`analytics_events` is append-only. Aggregations happen at read time via Drizzle `groupBy + count` — there's no streaming pipeline, no separate analytics DB. React Query caches the result with `staleTime: 5 minutes`.

Per-form metrics surfaced on the dashboard:

- Views · starts · submissions · completion rate · avg completion time
- Submissions over time (daily, last 30 days) — line chart
- Per-field response distribution — bar chart, only for select/rating fields
- Top drop-off field — the field id most common in `abandon` events

## Theme system

Themes are pure data — a row in `themes` with a jsonb `config` carrying colors, fonts, border radius, and optional pattern/logo emoji. The renderer applies the config as CSS custom properties on the form container:

```css
:root[data-form-id="…"] {
  --form-bg: var(--theme-background);
  --form-surface: var(--theme-surface);
  /* … */
}
```

Switching themes is a single CSS variable swap — no rerender required, SSR-safe, instant in the builder preview.

## Embedding & external use

Two surfaces:

1. **Hosted forms** at `/f/[slug]` — full Probe UI, themed. Iframe-embeddable on a per-form basis.
2. **Endpoint forms** — no UI; the user POSTs to `/api/submit` from their own HTML. Designed for freelance client sites that already have a form and just want a "form to email" backend. Full security model and abuse mitigations are documented in `plan/todo.md` under "Endpoint forms".

## Performance budget

| Surface                              | Target            |
| ------------------------------------ | ----------------- |
| Initial JS for `/f/[slug]` (gzip)    | < 70 KB           |
| Initial JS for landing (gzip)        | < 90 KB           |
| TTFB on `/f/[slug]`                  | < 200ms (warm)    |
| Submit roundtrip                     | < 400ms p95       |
| `getForm` cached                     | revalidated 60s   |

Achieved via:

- Route-level code-splitting. The form builder is its own dynamic import; respondents never download it.
- Theme CSS variables — no per-theme JS bundle.
- RSC for the public form page — the field components are server components by default; only the interactive ones opt in to `"use client"`.
- React Email templates rendered on the server at send time, never shipped to the browser.

## Files involved in deploy

| Path                                | Role                                                   |
| ----------------------------------- | ------------------------------------------------------ |
| `Dockerfile`                        | Multi-stage; one image; pnpm install + build           |
| `.dockerignore`                     | Excludes `node_modules`, `.git`, `.env`, `.next`       |
| `config/deploy.yml`                 | Kamal config — service, proxy, env, Postgres accessory |
| `.kamal/secrets`                    | Env-var template; committed (only `$VAR` refs, no literals) |
| `.github/workflows/deploy.yml`      | Manual-dispatch deploy workflow                        |
| `apps/web/next.config.mjs`          | Security headers, public env exposure                  |

## Migrations

`drizzle-kit push` for hackathon-speed iteration (drops then re-creates as the schema evolves; we don't carry migration history yet). Before opening for real users, switch to `drizzle-kit generate` + check-in SQL files and run them at container start via the Dockerfile `CMD`.

The seed (`pnpm db:seed`) is idempotent — wipes the demo user's forms and re-creates them. Faker is seeded with `42` for reproducibility.

---

## AI form generation

Users bring their own Anthropic API key — Probe bears no AI cost.

**Key management**: The key is submitted via Dashboard → Settings → AI form generation. On save, it is encrypted with AES-256-GCM (key derived via HKDF-SHA256 from `BETTER_AUTH_SECRET` + a per-user salt) and stored on the `users` table. The plaintext key is only decrypted server-side at generation time and is never logged or returned to the client. Clearing the key wipes the ciphertext.

**Generation flow**: The `trpc.ai.generateForm` mutation sends the user's prompt to the Anthropic API via forced tool-use (model: `claude-opus-4-7`). The model returns a structured list of fields that the mutation persists directly into the database as a new form, then returns the form ID for redirect. The user can edit all fields after generation.

**UI**: `trpc.ai.status` returns `{ hasKey: boolean, model?: string }`. The "✨ Generate with AI" panel on the new-form page (`/dashboard/forms/new`) is rendered only when `hasKey` is true. When false, a prompt to add a key in Settings is shown instead.

**No server env var needed**: AI generation is entirely user-key-driven. There is no `ANTHROPIC_API_KEY` server env var.

---

## Admin-gated integrations (Discord + Google Sheets)

Integrations follow a two-level model: **availability** (configured env) and **enabled** (admin flag).

### Availability vs enabled

| State | Condition | Admin UI |
|---|---|---|
| Unavailable | Required env vars absent | Toggle disabled; "Configure … to enable" shown |
| Available but off | Env vars present, admin has not enabled | Toggle is off |
| Enabled | Env vars present, admin toggled on | Toggle is on; form owners can configure per form |

This prevents admins from enabling integrations that are not actually configured, and lets operators ship new integration support without it being visible until the credentials are in place.

### Discord

No global env var. Each form owner pastes a Discord webhook URL in the form builder (Dashboard → Forms → [form] → Integrations → Discord). The webhook URL is stored per form in the form's settings jsonb.

### Google Sheets

Requires `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` in the server env. The OAuth flow uses redirect URI `https://<domain>/api/integrations/google/callback` with scope `https://www.googleapis.com/auth/spreadsheets`. The access and refresh tokens are stored per form owner (not per form). Each form is then linked to a specific spreadsheet ID.

### Delivery

Both integrations deliver asynchronously and non-blockingly. A failed Discord webhook or Sheets write never causes a form submission to fail or return an error to the respondent. Delivery errors are logged server-side.

---

## File uploads (Cloudflare R2)

A `file_upload` field type backed by presigned R2 uploads.

**Flow**:
1. The form renderer requests a presigned upload URL from the API (`trpc.public.presignUpload`).
2. The browser uploads the file directly to R2 using the presigned URL (PUT request) — the file never transits the Probe server.
3. On successful upload, the browser stores the resulting `R2_PUBLIC_BASE_URL/<key>` in the field value.
4. On form submit, the URL is stored in `response_values` like any other field value.

**Configuration**: Requires five env vars (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`). If any are absent, the `file_upload` field type is hidden in the builder UI with the message "Configure R2 storage to enable file uploads". Existing forms with no file upload fields are completely unaffected.

**Scope**: File uploads apply to hosted forms only. Endpoint forms (`/submit`) do not accept file uploads.

---

## Donation nudges

Contextual "buy me a chai" prompts that appear in the dashboard footer and as toasts after publish and export actions.

**Gate**: Controlled entirely by the build-time variable `NEXT_PUBLIC_ENABLE_CHAI_NUDGE`. When `false` (the default), no nudge UI is rendered — the code paths are present but the component returns null. When `true`, the nudge is shown with a link to `NEXT_PUBLIC_RAZORPAY_DONATE_LINK`.

**Self-host behaviour**: Self-hosters who clone the repo get `NEXT_PUBLIC_ENABLE_CHAI_NUDGE=false` by default, so their users will never see a donate link pointing at the original author's account. The hosted instance at `probe.riftfi.com` sets it to `true` via a build arg in `config/deploy.yml`.

**Build-time note**: Because this is a `NEXT_PUBLIC_*` variable, changing it requires a new Docker build, not just a container restart. In `config/deploy.yml`, `builder.args` passes it through to the Dockerfile `ARG`/`ENV` declarations so Kamal handles this automatically on each `deploy`.

---

## HTML template gallery

Static, self-contained HTML pages available at `/templates/html` for download.

**Files**: Four templates live in `apps/web/public/form-templates/` — `contact.html`, `newsletter.html`, `waitlist.html`, `feedback.html`. They are plain HTML files with inline CSS and a `<form>` pointing at `https://probe.riftfi.com/api/submit`. The access key placeholder (`YOUR_ACCESS_KEY`) must be replaced by the user after downloading.

**No account required to download**: The gallery page is public. Users only need an account when they want to generate an access key (Dashboard → Endpoint Forms → New) so submissions actually deliver.

**Pre-wired security**: Each template includes the honeypot field (`<input name="botcheck" style="display:none">`). Origin checking is handled server-side by the endpoint form's `allowedOrigins` setting.

**Relation to the endpoint-form surface**: The HTML template gallery is a discoverability and onboarding feature layered on top of the existing endpoint-forms backend. Technically it is just a static file download — no new backend logic.

---

— *Probe is based on [ChaiForm](https://github.com/developedbysaad) by Saad (MIT).*
