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
  pnpm --filter @repo/database exec drizzle-kit push --force \
    && echo "✅ schema push complete" \
    || echo "⚠️  schema push failed — run the 'migrate' action (DB may already be current)"
  # Built-in themes (idempotent upsert). The builder needs at least one theme,
  # so a fresh database works without running the demo seed.
  pnpm --filter @repo/database db:themes || echo "⚠️  theme load failed — run 'pnpm db:themes'"
) &

echo "🚀 starting API on :8000…"
PORT=8000 pnpm --filter @repo/api start &
API_PID=$!

# Give the API a moment so the web app's proxy + healthcheck succeed on boot.
sleep 2

echo "🌐 starting web on :3000…"
PORT=3000 pnpm --filter web start &
WEB_PID=$!

# If either process exits, tear the container down so Kamal restarts it.
wait -n 2>/dev/null || wait "$API_PID" "$WEB_PID"
echo "⚠️  a process exited — shutting down container."
kill "$API_PID" "$WEB_PID" 2>/dev/null || true
exit 1
