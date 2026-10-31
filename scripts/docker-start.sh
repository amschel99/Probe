#!/bin/sh
# Single-container entrypoint: run the API (:8000) and the Next web app (:3000)
# together. The web app reverse-proxies /trpc, /api/auth, /submit, /docs, etc.
# to the API on localhost:8000 (single origin).
set -e

# Schema push runs in the BACKGROUND so it never blocks API boot. On a cold
# first deploy Postgres is still running initdb, and a synchronous push here
# would stall the API past the 30s proxy healthcheck. /health doesn't touch the
# DB, so the container can become healthy immediately while the schema is
# applied alongside. For a guaranteed, observable migration, use the `migrate`
# deploy action instead of relying on this.
echo "🔎 Probe — applying database schema (drizzle push) in background…"
(
  # drizzle-kit can exit 0 even when it couldn't connect, so success is judged
  # by the theme load (a real query). Retry while Postgres boots or while its
  # credentials are being sorted out, instead of giving up on the first try.
  ok=0
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
    pnpm --filter @repo/database exec drizzle-kit push --force
    if pnpm --filter @repo/database db:themes; then
      echo "✅ schema + themes applied (attempt $attempt)"
      ok=1
      break
    fi
    echo "⏳ database not ready (attempt $attempt/12) — retrying in 10s"
    sleep 10
  done
  [ "$ok" = 1 ] || echo "❌ schema push FAILED — check DATABASE_URL, then restart the service"
) &

echo "🚀 starting API on :8000…"
PORT=8000 pnpm --filter @repo/api start &
API_PID=$!

# Give the API a moment so the web app's proxy + healthcheck succeed on boot.
sleep 2

echo "🌐 starting web on :${PORT:-3000}…"
pnpm --filter web exec next start -p "${PORT:-3000}" &
WEB_PID=$!

# If either process exits, tear the container down so Kamal restarts it.
wait -n 2>/dev/null || wait "$API_PID" "$WEB_PID"
echo "⚠️  a process exited — shutting down container."
kill "$API_PID" "$WEB_PID" 2>/dev/null || true
exit 1
