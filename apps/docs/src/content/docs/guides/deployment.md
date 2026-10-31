---
title: Deployment
description: Run Probe on Railway with a Postgres service, a custom domain and email. What happens on boot, updating, and troubleshooting.
---

Probe runs as one container and a Postgres database. The live instance at [probe.jahazi.city](https://probe.jahazi.city) runs on Railway, deployed from the [GitHub repo](https://github.com/amschel99/Probe). This guide sets up the same thing.

## What you are deploying

One container runs two processes:

- **API** on port 8000: Express, tRPC and Better Auth. Internal only.
- **Web** on Railway's `$PORT`: Next.js. It serves the pages and proxies `/trpc`, `/api/auth`, `/submit`, `/docs`, `/api/docs`, `/openapi.json` and the export URLs to the API.

Everything is on one origin, so there is one domain, one certificate and no CORS for the dashboard.

Postgres runs as a separate Railway service.

The repo has a `Dockerfile` and a `railway.toml`. Railway builds the image from the Dockerfile and checks `/health` before sending traffic.

## 1. Create the project

1. Fork [amschel99/Probe](https://github.com/amschel99/Probe), or use your own copy.
2. In Railway, click **New project → Deploy from GitHub repo** and pick the repo.
3. Railway finds `railway.toml` and builds with the Dockerfile. The first build fails or crash-loops until the variables are set. That is expected.

## 2. Add Postgres

In the same project, click **New → Database → PostgreSQL**. Railway creates a service called `Postgres`.

You do not need to create tables. Probe applies its schema on every boot.

## 3. Set the variables

Open the Probe service, go to **Variables**, and add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `BETTER_AUTH_SECRET` | A random string of 32 or more characters. Run `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | Your public origin, such as `https://forms.example.com` |
| `PUBLIC_APP_URL` | The same origin |
| `NODE_ENV` | `production` |

`DATABASE_URL` must be the reference `${{Postgres.DATABASE_URL}}`, typed exactly like that. Do not paste the connection string by hand. The reference keeps working if Railway changes the database's host or password.

Do not set `NEXT_PUBLIC_API_URL` in production. Without it, the browser calls `/trpc` on the same origin and the web app proxies it. With it, the browser tries to reach the API directly and fails.

Keep `BETTER_AUTH_SECRET` safe and do not change it. It signs sessions and is the key for every stored secret: captcha secrets, AI keys and Google tokens. Changing it signs everyone out and makes those secrets unreadable.

Optional variables for email, AI, file uploads, Google Sheets and rate limiting are covered below and in [Environment variables](/docs/reference/environment/).

Railway redeploys when you save variables.

## 4. Add your domain

1. In the Probe service, go to **Settings → Networking**.
2. Click **Generate domain** to get a `*.up.railway.app` address, or **Custom domain** to use your own.
3. For a custom domain, Railway shows a CNAME target. At your DNS provider, add a `CNAME` record from your subdomain (for example `forms`) to that target.
4. Wait for Railway to show the domain as active. It issues the certificate.

Then set `BETTER_AUTH_URL` and `PUBLIC_APP_URL` to the new `https://` origin. They must match the address people type. Sign-in, password reset and email links are built from them.

## 5. Set up email

Without email, Probe still works. Verification and password-reset links are printed in the server logs instead of being sent. Set up email before you invite anyone.

Probe sends email through [Resend](https://resend.com). It is used for:

- Endpoint-form recipient verification.
- Response notifications and confirmation emails.
- Password reset.

To set it up:

1. Create a Resend account.
2. Go to **Domains → Add domain** and enter the domain you will send from, such as `example.com`.
3. Add the DNS records Resend shows (SPF and DKIM, plus the optional DMARC record) at your DNS provider.
4. Wait for Resend to mark the domain **Verified**. Until then it will not send from that domain.
5. Go to **API keys** and create a key with sending access.
6. In Railway, set:

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | `re_…` |
| `RESEND_FROM` | `Probe <noreply@example.com>`, on the domain you verified |

Change `RESEND_FROM`. The default address is on a domain you do not own, so Resend will reject it.

## 6. Sign in

Open your domain and go to `/register`. The first account registered becomes the admin. Register yourself straight away, before you share the address.

Do not run `pnpm db:seed` on a public instance. It creates demo accounts with known passwords.

## What happens on boot

`scripts/docker-start.sh` starts the API and the web app at once, so the health check passes quickly. In the background it applies the database schema, retrying every 10 seconds for about two minutes:

1. `drizzle-kit push` brings the tables in line with the code.
2. `pnpm db:ensure` adds any newer columns and tables that must exist, and checks them with a real query.
3. `pnpm db:themes` loads the built-in themes.

Look for one of these lines in the deploy logs:

```text
✅ schema + themes applied (attempt 1)
❌ schema push FAILED — check DATABASE_URL, then restart the service
```

Retries while Postgres is starting show as `⏳ database not ready`. If you see the failure line, fix `DATABASE_URL` and restart the service.

`/health` does not touch the database. A green health check means both processes are up, not that the schema applied. Check the log line.

## Updating

Push to the branch Railway deploys from. Railway builds a new image and swaps it in when `/health` passes. The schema is applied again on boot, so new columns appear without a manual step.

To redeploy without a code change, open the latest deployment in Railway and click **Redeploy**.

## Optional features

Each optional feature stays off until its variables are set. Nothing breaks without them.

| Feature | Variables | Then |
|---|---|---|
| AI for everyone | `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` | See [AI form generation](/docs/guides/ai-generation/). |
| File uploads | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | The file upload field becomes available. |
| Google Sheets | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | Enable it in **Admin → Integrations**. |
| Discord | none | Enable it in **Admin → Integrations**. |
| Shared rate limits | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Only needed with more than one replica. |

### Google Sheets

1. In [Google Cloud Console](https://console.cloud.google.com), create or pick a project.
2. Under **APIs & Services → Library**, enable the **Google Sheets API**. Without it, the first row append fails with a 403.
3. Configure the **OAuth consent screen**. Choose **External** and add the scope `https://www.googleapis.com/auth/spreadsheets`. While the app is in **Testing**, only the test users you list can connect. Add yourself, or publish the app.
4. Under **Credentials**, create an **OAuth client ID** of type **Web application**.
5. Add the redirect URI `https://<your-domain>/api/integrations/google/callback`.
6. Set `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` in Railway.
7. Sign in as admin, open **Admin → Integrations** and enable Google Sheets.

### File uploads with Cloudflare R2

1. In Cloudflare, go to **R2** and create a bucket. Note its name and your account ID.
2. Create an R2 API token with **Object Read & Write** on that bucket.
3. Give the bucket a public URL: turn on the `r2.dev` address or connect a custom domain.
4. Add a CORS policy to the bucket. Browsers upload straight to R2, so it must allow `PUT` from your domain:

```json
[
  {
    "AllowedOrigins": ["https://<your-domain>"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

5. Set the five `R2_*` variables in Railway.

## Reset a password from the command line

If the admin is locked out and email is not set up, set a new password directly against the database. Run this on your own machine, from a clone of the repo with dependencies installed:

```bash
DATABASE_URL="postgresql://…" pnpm reset-password you@example.com 'a-new-password'
```

Use the Postgres service's `DATABASE_PUBLIC_URL` from Railway. The internal `DATABASE_URL` only works inside Railway's network. The password must be at least 8 characters. The command also signs that account out everywhere.

## Troubleshooting

### `password authentication failed for user "postgres"` (28P01)

Probe cannot log in to Postgres.

1. Check that `DATABASE_URL` on the Probe service is exactly `${{Postgres.DATABASE_URL}}`, not a pasted string.
2. If it is, the password variable on the Postgres service was probably changed after the database was created. Postgres keeps the password it was created with. Open the Postgres service, connect to the database (for example with **Data → Query**, or `psql` with `DATABASE_PUBLIC_URL`) and run:

```sql
ALTER USER postgres PASSWORD '<the value of POSTGRES_PASSWORD>';
```

3. Restart the Probe service.

### `column "…" does not exist`

The code is newer than the database schema. Restart or redeploy the Probe service. Boot applies the schema again. Check for the `✅ schema + themes applied` line.

### "Invalid redirectURL" or sign-in fails with an origin error

`BETTER_AUTH_URL` and `PUBLIC_APP_URL` do not match the domain you are using. Set both to the public origin, with `https://` and no trailing slash, and redeploy.

### "Too many requests" when resetting a password

Auth endpoints are rate-limited by IP. Wait a minute and try again.

### No emails arrive

- Check that `RESEND_API_KEY` is set.
- Check that `RESEND_FROM` is on a domain verified in Resend.
- Look in the server logs. Without email, Probe prints verification and reset links there.

### The build fails while loading fonts

Older versions downloaded fonts from Google during `next build`, which could fail. The fonts are now committed to the repo. Pull the latest code.

## Other hosts and Kamal

Probe runs anywhere that can build the Dockerfile and give it a Postgres database. Set the same variables. The container listens on `$PORT`, or 3000 if it is unset, and answers `/health`.

The repo also keeps a Kamal setup as an alternative for a single VPS: `config/deploy.yml`, `.kamal/secrets` and a manual GitHub Actions workflow in `.github/workflows/deploy.yml`. It runs Postgres as a Kamal accessory on the same host and uses `kamal-proxy` for TLS. Railway is the supported path. Read those files before using Kamal.
