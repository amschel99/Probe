# ChaiForm — Build Plan & Working Notes

Single source of truth for what we're building, the order we're building it in, and the architectural patterns we've committed to. Everything in this file is internal — kept under version control so future-me (or anyone else) can pick up exactly where we left off.



## Product summary

ChaiForm is an open-source form builder. Two product surfaces:

1. **Hosted forms** — full ChaiForm-themed pages at `chaiforms.developedbysaad.com/f/<slug>`. The user builds in a three-panel builder, picks one of 10 themes, shares the link. Responses + analytics live in the dashboard.
2. **Endpoint forms** — no UI built in ChaiForm. The user POSTs to `chaiforms.developedbysaad.com/api/submit` with their own HTML form. ChaiForm acts as a "form-to-email" backend. Designed for freelance contact forms on client sites where the page UI already exists.

Both flows use the same database, same dashboard, same theming options.

---

## Adopted architectural patterns

These are decided. Stick to them unless we hit a wall.

### 1. Single-origin deployment

One Docker image, one Node process, one DNS record: `chaiforms.developedbysaad.com`. Next.js serves pages and proxies `/api/*` into a mounted Hono app. No `api-chaiforms.*` subdomain. No CORS package on first-party calls — same-origin cookies for sessions. CORS is enabled only on `/api/submit` (the public endpoint-forms surface) where cross-origin POSTs are the entire point.

Tradeoff: can't independently scale the API. Acceptable at hackathon scale and well beyond it.

### 2. Hono mounted inside Next.js Route Handlers

`apps/web/app/api/[[...path]]/route.ts` exports `GET/POST = (req) => app.fetch(req)`. `packages/server` is a library — it exports the Hono `app`, the tRPC `appRouter` type, the Better Auth instance. Nothing in `packages/server` ever calls `serve()` directly.

### 3. Single source of truth for types

- Drizzle infers DB row types (`typeof users.$inferSelect`).
- Zod schemas in `packages/validators` define API input shapes — `infer` gives both server-validation types and client-form types.
- tRPC v11 with superjson surfaces server types to the frontend without manual re-declaration.

If a constraint exists in three places (DB column length, API schema max, UI maxlength), all three references resolve to the same constant or schema export — no copy-pasted numbers.

### 4. Cascading deletes at the DB layer

`ON DELETE CASCADE` on every FK that should compose. Deleting a form is a single `.delete()` — the database removes fields, responses, response_values, and analytics_events. Application code never loops to clean up children.

### 5. Append-only analytics

`analytics_events` is never updated. Aggregations are read-time via Drizzle `groupBy + count`. React Query caches the result for 5 minutes. No separate analytics DB, no streaming pipeline.

### 6. Better Auth + cookies, no JWT

Sessions are Postgres rows accessed via cookies set by the same origin that reads them. No `Authorization` header, no token refresh logic, no localStorage auth state. Cross-tab logout works because the session is in the DB, not in memory.

### 7. IP is hashed, never stored raw

`SHA-256(ip + BETTER_AUTH_SECRET)`. Used for rate-limit keys and ballot-stuffing heuristics. Rotating the secret invalidates all hashes. Never surfaced in the UI.

### 8. Ownership guards return `NOT_FOUND`, not `FORBIDDEN`

For protected resources, "you don't own this" returns the same code as "doesn't exist". A probe can't enumerate which IDs belong to which users.

### 9. Rate limiting in one named place

`packages/server/src/lib/ratelimit.ts` exports `submitLimiter`, `eventLimiter`, `authLimiter`. Don't sprinkle `Ratelimit` instances elsewhere. If a new limit is needed, add it there.

### 10. Validation lives in `packages/validators`

One file per resource (`auth.ts`, `form.ts`, `field.ts`, `response.ts`, `theme.ts`). Both server (tRPC `.input(schema)`) and client (`react-hook-form` resolver) consume the same exports.

---

## Build order

### Day 1 — Foundation ✅

- [x] Turborepo init, pnpm workspaces, shared tsconfig
- [x] `packages/db` — Drizzle schema (users, sessions, themes, forms, fields, responses, response_values, analytics_events), Neon client, seed with 10 themes + 5 forms
- [x] `packages/validators` — Zod schemas for auth/form/field/response/theme + runtime `buildResponseSchema`
- [x] `packages/email` — Resend wrapper + template stubs
- [x] Hono entry, Better Auth wired, tRPC root with auth + themes routers, Scalar `/docs`, Upstash rate limiter, IP hash helper, ownership guard

### Day 1.5 — Single-origin refactor ✅

- [x] Moved `apps/api/src/*` → `packages/server/src/*`. Dropped `serve()` + global CORS. CORS scoped to the `/submit` endpoint only.
- [x] `packages/server` is a library; `app` + `appRouter` + `auth` are its exports.
- [x] Re-pointed env: dropped `NEXT_PUBLIC_API_URL` and `ALLOWED_ORIGINS`.

### Day 2 — Auth + Forms/Fields tRPC routers ✅

- [x] `auth.me`, `auth.status`, `auth.requireAuth`.
- [x] `forms.list`, `forms.get`, `forms.create`, `forms.update`, `forms.delete`, `forms.publish`, `forms.unpublish`, `forms.duplicate`, `forms.setPassword`, `forms.getAnalytics`, `forms.fieldDistribution`.
- [x] `fields.list`, `fields.create`, `fields.update`, `fields.delete`, `fields.reorder` (single transaction).

### Day 3 — Dashboard UI ✅

- [x] `apps/web` scaffolded — Next.js 14 App Router, Tailwind v4, tRPC v11 React client wired in `app/providers.tsx`.
- [x] `app/api/[[...path]]/route.ts` catch-all → `app.fetch(req)`.
- [x] `middleware.ts` reads Better Auth session cookie, redirects `/dashboard/*` → `/login` when absent.
- [x] `/login`, `/register` — react-hook-form + Zod, POST to Better Auth.
- [x] `/dashboard` overview, `/dashboard/forms` list, `/dashboard/forms/new` create wizard.
- [x] `/dashboard/forms/[id]` three-panel builder with dnd-kit sortable, debounced auto-save, theme picker, field settings, form settings, preview toggle.

### Day 4 — Public form renderer + submission ✅

- [x] `public.getForm` with full guard chain (form exists → published → not expired → not full → password check).
- [x] `public.submitResponse` runs `buildResponseSchema(fields)`, rate-limited 5/IP/form/hour, hashes IP, persists in a transaction, bumps counters, fires emails async.
- [x] `public.trackEvent` (view/start/abandon) — rate-limited per IP.
- [x] `/f/[slug]` SSR route fetches via the server-side tRPC caller and renders the themed `FormRenderer`.
- [x] All 11 field types: short_text, long_text, email, number, single_select, multi_select, checkbox, rating, date, phone, url. RatingInput supports star/number/emoji styles.
- [x] Success, closed (PRECONDITION_FAILED), locked (password), not-found screens.

### Day 5 — Responses + analytics ✅

- [x] `responses.list` paginated + date filter, `responses.get`, `responses.delete` (decrements `responseCount` in same txn), `responses.exportCsv`.
- [x] `forms.getAnalytics` returning eventCounts / completionRate / daily series / topDropoffFieldId / avgCompletionMs.
- [x] `/dashboard/forms/[id]/responses` paginated table with per-row detail fetch + CSV export.
- [x] `/dashboard/forms/[id]/analytics` stat cards + Recharts daily line + drop-off + avg time.
- [x] `/dashboard/forms/[id]/share` — link copy, QR code (qrcode.react), embed snippet.

### Day 6 — Endpoint forms ✅

- [x] DB: added `forms.type/accessKey/accessKeyVerifiedAt/recipientEmail/websiteUrl/allowedOrigins/endpointSettings`, `responses.payload/spamFlagged`, new `access_key_verifications` + `endpoint_audit` tables.
- [x] `endpoint` router: `list`, `get`, `create`, `update`, `rotateKey`, `resendVerification`, `delete`, `auditLog`, `verifyByToken`.
- [x] `POST /api/submit` — Hono route with CORS, payload caps (64KB / 50 fields), access key lookup, Origin allowlist (with wildcard subdomain support), honeypot (`botcheck`), captcha verify (hCaptcha + reCAPTCHA via env-configured verify URLs), rate limit headers, optional 303 redirect with allowlist check, signed webhook (HMAC-SHA256, `X-ChaiForm-Signature`).
- [x] `GET /api/verify-access-key/:token` — single-use, time-bound link with friendly HTML success/expired/used pages.
- [x] AES-256-GCM encryption (`packages/server/src/lib/crypto.ts`) for captcha secrets at rest. Key derived via HKDF-SHA256 from `BETTER_AUTH_SECRET` + per-form salt.
- [x] `/dashboard/endpoint-forms` list + create wizard (name + website) + detail page with Snippet / Submissions / Settings / Security tabs and HTML/fetch/React snippet generator.

### Day 7 — Landing, marketing, deploy ✅

- [x] Landing page — satirical hero, feature grid, theme gallery (using live themes from DB), endpoint-forms callout.
- [x] `/open-source` — GitHub star, Razorpay donate link, socials, feature table.
- [x] `/explore` — public form grid with search; `status='published' AND visibility='public'` only.
- [x] `/templates` — themed starters linking into the create flow.
- [x] Share panel — link copy, QR, embed snippet.
- [x] React Email templates wired to Resend (welcome / formNotification / responseConfirmation).
- [x] Scalar `/api/docs` documenting `getForm`, `submitResponse`, `listPublicForms`, `/submit`, `sign-in/sign-up`.
- [x] `Dockerfile` (multi-stage pnpm), `.dockerignore`, `config/deploy.yml` (single Kamal service + Postgres accessory), `.kamal/secrets`, `.github/workflows/deploy.yml`.
- [x] `scripts/smoke-test.sh` — 19-section batch curl test exercising every public surface. 25/25 passing locally.

### Things deferred (intentionally)

- [ ] React Email JSX templates (we ship inline HTML in `@chaiforms/email/index.ts` for now).
- [ ] Per-field response distribution chart on analytics (data is there via `forms.fieldDistribution`, no chart wired yet).
- [ ] Endpoint webhook re-delivery on failure (single attempt for now).
- [ ] Custom domain support, team accounts, file uploads, AI-generated form drafts.

---

## Endpoint forms — feature design

The "no-UI" form backend. Users sign up, get an access key, paste a snippet into their HTML, and submissions land in their inbox.

### Sign-up flow

Two fields:

| Field          | Notes                                                            |
| -------------- | ---------------------------------------------------------------- |
| **Form name**  | Display label only. Shown in dashboard and email subject lines. |
| **Website**    | Origin allowlist. Submissions from other origins are 403'd (unless origin checking is disabled). |

On submit, generate a 36-char URL-safe access key (`nanoid(36)` with custom alphabet — letters + digits, no ambiguous chars) and send a **recipient-verification email** to the signed-in user's email (or to a separate recipient if specified). Until verified, the access key returns 403 on submission attempts. This prevents abuse where someone signs up with another person's email to send them spam.

### Data model

Extend `forms` with:

```ts
type: enum("hosted", "endpoint")   // default 'hosted'
accessKey: text unique             // null for hosted forms
accessKeyVerifiedAt: timestamp     // null until recipient confirms
recipientEmail: text               // null for hosted forms; set from session.user.email
allowedOrigins: text[]             // origin allowlist; e.g. ['https://example.com']
endpointSettings: jsonb {
  honeypotEnabled: boolean,        // default true
  captchaProvider: 'none'|'hcaptcha'|'recaptcha',  // default 'none'
  captchaSiteKey: string|null,
  captchaSecret: string|null,       // encrypted at rest; see Secrets storage below
  subjectTemplate: string,         // e.g. "New submission from {form_name}"
  notifyEmails: text[],            // optional cc; verified separately
  redirectUrl: string|null,        // 303 target if `redirect` field present in submission
  webhookUrl: string|null,         // optional fire-and-forget forward
}
lastSubmittedAt: timestamp
```

Endpoint-form submissions still land in `responses` + `response_values` (no separate table), but with:

- `responses.submissionType = 'endpoint'`
- `response_values` keyed by a synthesized field id for each unique field name in the payload (created on first sight) OR — simpler — store the entire payload in a single `responses.payload jsonb` column and don't create per-field rows. **Decision:** single-payload jsonb. Endpoint forms have no schema; trying to normalize free-form payloads into `fields` is more pain than it's worth.

Add column: `responses.payload jsonb` — nullable, set only for endpoint submissions.

### Endpoint shape

```
POST /api/submit
Content-Type: application/json | application/x-www-form-urlencoded | multipart/form-data
```

Accepts:

| Field             | Required | Notes                                                       |
| ----------------- | -------- | ----------------------------------------------------------- |
| `access_key`      | yes      | Public key. Lookup by indexed column on `forms`.            |
| `email`           | no       | Sets `Reply-To` on the outbound email.                       |
| `from_name`       | no       | Friendly name on `Reply-To`.                                 |
| `subject`         | no       | Overrides `endpointSettings.subjectTemplate`.                |
| `redirect`        | no       | Return 303 to this URL. Must match `allowedOrigins`.         |
| `botcheck`        | no       | Honeypot. If truthy → return 200 success but **drop**.       |
| `h-captcha-response` / `g-recaptcha-response` | no | Validated server-side when captcha enabled. |
| anything else     | —        | Stored under `responses.payload`.                            |

### Response shape

| Status | Body                                                            |
| ------ | --------------------------------------------------------------- |
| 200    | `{ "success": true, "message": "Submission received" }`         |
| 303    | Redirect to `redirect` (if provided + allowed)                  |
| 400    | `{ "success": false, "code": "INVALID_INPUT", "message": "…" }` |
| 401    | `{ "success": false, "code": "INVALID_ACCESS_KEY", "message": "Unknown access key" }` |
| 403    | `{ "success": false, "code": "ORIGIN_NOT_ALLOWED", "message": "Origin not in allowlist" }` |
| 403    | `{ "success": false, "code": "ACCESS_KEY_UNVERIFIED", "message": "Recipient hasn't verified this key yet" }` |
| 429    | `{ "success": false, "code": "RATE_LIMITED", "message": "Too many submissions" }` |
| 422    | `{ "success": false, "code": "SPAM_REJECTED", "message": "Submission flagged as spam" }` |

### Security model

The whole point of the access key being public means attackers will find it. Defense isn't "keep the key secret" — defense is layered abuse mitigation.

1. **Access key is public, but verified.** Lookup is by an indexed unique column. The key alone gets you an empty 200 if it's not yet verified; the verification email has a single-use, time-bound (24h) `/verify-access-key/<token>` link. **The unverified state lets the owner test integration without spamming themselves; submissions during this window are 200'd but emails are queued, not sent, and shown in dashboard with a "verify to receive" prompt.**

2. **Origin allowlist.** `Origin` and `Referer` headers checked against `allowedOrigins`. Wildcards (`*.example.com`) allowed. Empty allowlist = open (only enable with explicit owner action). Server-to-server submissions (no Origin) are allowed only when the owner has explicitly opted into server-side use — otherwise 403.

3. **Honeypot.** Hidden field `botcheck` (CSS `display:none`). If filled, return 200 success silently; never email, never store. Bots that auto-fill all visible fields trip it. Disabled by setting `endpointSettings.honeypotEnabled = false` if the owner needs a `botcheck` field for non-spam reasons.

4. **Captcha (optional).** Owner can enable hCaptcha or reCAPTCHA in dashboard. We accept their **site key** (public, embedded in their HTML) and **secret key** (verified server-side). Secret is encrypted at rest (AES-GCM via `BETTER_AUTH_SECRET`-derived key) and decrypted only at submission time. If captcha is enabled and the response field is missing or invalid, reject 422.

5. **Rate limits.** Three layers, all via Upstash:
   - Per IP per access key: 5/minute, 60/hour.
   - Per access key globally: 1000/day on the free tier (configurable; protects the owner's email quota).
   - Per IP globally across all forms: 60/minute (cheap safeguard against scanners).

6. **Content size cap.** Total request body ≤ 64 KB. Reject larger with 413. Prevents storage exhaustion.

7. **Field count cap.** Max 50 keys in the payload. Reject larger with 400.

8. **PII handling.** Submitter IP is hashed before any storage. User agent stored as-is (truncated to 500 chars). No raw IP anywhere.

9. **Verification of `redirect` URL.** Must be an absolute URL whose origin matches `allowedOrigins`. Prevents using ChaiForm as an open-redirect for phishing.

10. **Recipient email change requires re-verification.** Editing `recipientEmail` in dashboard sends a fresh verification email; until verified, submissions still go to the previous (verified) recipient.

11. **Key rotation.** Owner can rotate `accessKey` at any time from the dashboard. Old key is invalidated immediately. A 30-day grace period option (accept old key with a deprecation warning header in the response) is a stretch goal.

12. **Audit log.** A small append-only `endpoint_audit` table captures: key rotated, recipient changed, captcha toggled, allowlist changed, deletes. Surfaced in the dashboard's "Security" tab for that form.

13. **Webhook security.** Optional webhook URL must be HTTPS. We sign each delivery with `HMAC-SHA256(payload, webhookSigningSecret)` and include it as `X-ChaiForm-Signature`. Receivers verify before trusting.

14. **No file uploads (free tier).** Closes off the largest abuse vector (storage costs, AV scanning, malware proxying). Revisit if it becomes a frequent request.

15. **Spam scoring (stretch).** Optional content-based filter: keyword blocklist (configurable per form), URL count (>3 URLs in a single field triggers review), repeated identical submissions from same IP hash. Flagged submissions land in a "Pending review" bucket, not the inbox.

16. **CORS.** `/api/submit` allows `*` for OPTIONS/POST. Method allowlist: `OPTIONS, POST`. No credentials. The origin check (#2) is the real gate; CORS just lets browsers send the request.

17. **Email delivery.**
    - `From: ChaiForm <noreply@developedbysaad.com>` (we own the SPF/DKIM).
    - `Reply-To: {submitter.email}` if provided, else falls back to `noreply@`.
    - `To: {recipientEmail}` plus verified `notifyEmails`.
    - Subject: `endpointSettings.subjectTemplate` rendered with `{form_name}`, `{submitter_email}`, `{submitter_name}` variables.
    - Body: HTML table of all submitted fields. Sanitize HTML in submitted values — never render attacker HTML, escape everything.

18. **Secrets storage.** When the owner enters a captcha secret key:
    - Encrypt with AES-256-GCM. Key derived from `BETTER_AUTH_SECRET` via HKDF-SHA-256 with a per-form salt stored alongside the ciphertext.
    - Store `{ ciphertext, iv, authTag, salt }` as jsonb.
    - Decrypt only at submission time in memory. Never log.
    - Rotating `BETTER_AUTH_SECRET` invalidates stored secrets — owner must re-enter. Document this.

### Dashboard surface (`/dashboard/endpoint-forms`)

- List view: cards showing name, allowed origins, today's submission count, verification status.
- Create wizard: name → website → recipient (defaults to user.email) → "Send verification email".
- Detail view (`/dashboard/endpoint-forms/[id]`):
  - **Snippet** tab — copyable HTML snippet with the access key pre-filled. Tabs for HTML, React, fetch().
  - **Submissions** tab — same shape as hosted-form responses table, but `payload` rendered as key/value pairs.
  - **Settings** tab — origins, captcha, subject template, webhook URL, notify emails.
  - **Security** tab — rotate key, audit log.

### Snippet examples (shown in dashboard)

**HTML form (`POST` with redirect):**

```html
<form action="https://chaiforms.developedbysaad.com/api/submit" method="POST">
  <input type="hidden" name="access_key" value="YOUR_PUBLIC_ACCESS_KEY">
  <input type="hidden" name="subject" value="New contact form submission">
  <input type="hidden" name="redirect" value="https://your-site.com/thank-you">
  <input type="checkbox" name="botcheck" style="display:none">

  <input name="name" required>
  <input name="email" type="email" required>
  <textarea name="message" required></textarea>
  <button type="submit">Send</button>
</form>
```

**fetch (JSON):**

```js
await fetch("https://chaiforms.developedbysaad.com/api/submit", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    access_key: "YOUR_PUBLIC_ACCESS_KEY",
    name: form.name,
    email: form.email,
    message: form.message,
    botcheck: "",
  }),
});
```

### Open questions (resolve before Day 6)

- [ ] Do we expose endpoint forms in `/explore`? **Default: no.** They have no theme, no public URL. Skip.
- [ ] Do endpoint submissions count toward the free-tier daily cap (1000/day)? **Yes.** Cap is per access key, not per form-type.
- [ ] Do we support attachments / multipart? **Not in v1.** Document as "coming soon" or leave unmentioned.
- [ ] Do we support multiple webhook URLs? **One in v1.** Fan-out can be done by the user's own server.

---

## Operational checklist (Day 7)

The 12-step judge smoke test from the spec, plus endpoint-form checks:

```
1.  chaiforms.developedbysaad.com                       → landing loads, hero visible
2.  /explore                                            → public forms grid renders
3.  /f/[slug]                                            → fill + submit → thank-you
4.  /f/[unlisted-slug]                                   → loads when given the link
5.  /explore searched for unlisted form                  → NOT there
6.  /login → demo@developedbysaad.com / ChaiForm@2025   → dashboard loads
7.  Dashboard → open form → builder                      → drag, theme switch, auto-save
8.  Responses tab                                        → table + CSV export
9.  Analytics tab                                        → charts render
10. Share panel                                          → link copy, QR
11. /api/docs (Scalar)                                   → renders, lists /submit
12. /open-source → donate                                → Razorpay link opens
13. /dashboard/endpoint-forms/new                        → wizard works, key shown
14. POST /api/submit with valid key + verified recipient → email arrives within 30s
15. POST /api/submit with botcheck filled                → 200 returned, no email sent
16. POST /api/submit from origin not on allowlist        → 403
17. Rotate key in dashboard                              → old key returns 401 within 5s
```

---

## Risk register

| Risk                                              | Mitigation                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| Endpoint form abuse (spam to harvested emails)    | Recipient verification before any email sends. Honeypot + captcha + origin allowlist. |
| Captcha secret leak                               | AES-GCM at rest, decrypt-on-use, never logged.                    |
| Open redirect via `redirect` field                | URL origin must match `allowedOrigins`.                          |
| Storage growth from spam                          | Honeypot drops silently (no DB write). Spam-flagged go to a separate "review" bucket the owner can purge in one click. |
| Sender reputation damage if abused                | Per-key daily cap. Auto-suspend on abuse complaint received via DMARC reports. |
| Better Auth secret rotation invalidates sessions  | Documented in `secrets-and-safety` runbook. Roll in a maintenance window. |
| Drizzle push without history → schema drift in prod | Switch to `drizzle-kit generate` + checked-in SQL before going beyond hackathon scope. |

---

## Things deliberately out of scope (for v1)

- Multi-page forms / form sections
- Branching logic beyond simple `showIf` conditional rules
- Stripe / Razorpay payment fields inside forms (we accept donations via static link only — no real payment processing in submissions)
- Team accounts / multiple users per form
- Custom domains (`forms.yourcompany.com`)
- File uploads / attachments on endpoint forms
- AI-generated form drafts
- Spreadsheet import to create forms

Each of these is a real feature people ask for. None of them are blocking ship.
