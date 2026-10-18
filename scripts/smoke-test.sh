#!/usr/bin/env bash
# Probe smoke test — exercises every public surface via curl.
#
# Prereqs: the server is running at $BASE_URL (default http://localhost:3000)
# and the DB has been seeded (`pnpm db:seed`).
#
# Run with:    bash scripts/smoke-test.sh
# Set BASE_URL=https://probe.riftfi.com to target prod.

set -u
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

PASS=0
FAIL=0
pass() { printf "  ✅ %s\n" "$1"; PASS=$((PASS+1)); }
fail() { printf "  ❌ %s\n" "$1"; FAIL=$((FAIL+1)); }
section() { printf "\n\033[1m%s\033[0m\n" "$1"; }

expect_status() {
  local desc="$1"; local expected="$2"; local got="$3"
  if [ "$got" = "$expected" ]; then pass "$desc (got $got)"
  else fail "$desc (wanted $expected, got $got)"
  fi
}

status() { curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$@"; }

trpc_get() {
  local proc="$1"; local input_json="$2"
  local encoded
  encoded=$(printf '{"json":%s}' "$input_json" | python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.stdin.read()))')
  curl -s --max-time 15 -b "$COOKIE_JAR" "$BASE_URL/trpc/$proc?input=$encoded"
}

trpc_post() {
  local proc="$1"; local input_json="$2"
  curl -s --max-time 15 -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -X POST "$BASE_URL/trpc/$proc" \
    -H "Content-Type: application/json" \
    -d "{\"json\":$input_json}"
}

section "1. Health"
expect_status "GET /api/health" "200" "$(status "$BASE_URL/api/health")"

section "2. Marketing pages"
expect_status "GET /" "200" "$(status "$BASE_URL/")"
expect_status "GET /explore" "200" "$(status "$BASE_URL/explore")"
expect_status "GET /open-source" "200" "$(status "$BASE_URL/open-source")"
expect_status "GET /templates" "200" "$(status "$BASE_URL/templates")"

section "3. Docs site + API reference"
expect_status "GET /openapi.json" "200" "$(status "$BASE_URL/openapi.json")"
expect_status "GET /api/docs (Scalar API reference)" "200" "$(status "$BASE_URL/api/docs")"
expect_status "GET /docs (Starlight docs site)" "200" "$(status "$BASE_URL/docs/")"

section "4. tRPC public.listPublicForms"
list_resp=$(curl -s --max-time 15 \
  "$BASE_URL/trpc/public.listPublicForms?input=%7B%22json%22%3A%7B%22limit%22%3A24%7D%7D")
if echo "$list_resp" | grep -q '"items"'; then
  pass "public.listPublicForms returned items array"
  SLUG=$(echo "$list_resp" | grep -oP '"slug"\s*:\s*"[^"]+"' | head -n1 | cut -d'"' -f4 || true)
  if [ -n "${SLUG:-}" ]; then pass "Captured slug: $SLUG"
  else fail "No slug found"; fi
else
  fail "public.listPublicForms unexpected: $(echo "$list_resp" | head -c 200)"
fi

section "5. Public form pages"
if [ -n "${SLUG:-}" ]; then
  expect_status "GET /f/$SLUG" "200" "$(status "$BASE_URL/f/$SLUG")"
fi
expect_status "GET /f/zzz-does-not-exist (404)" "404" "$(status "$BASE_URL/f/zzz-does-not-exist")"

section "6. Login as demo user"
login_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  -c "$COOKIE_JAR" -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -d '{"email":"demo@probe.local","password":"Probe@2025"}')
expect_status "Login as demo user" "200" "$login_status"

section "7. /trpc/auth.me (authenticated)"
expect_status "auth.me with session" "200" "$(status -b "$COOKIE_JAR" "$BASE_URL/trpc/auth.me?input=%7B%22json%22%3Anull%7D")"

section "8. /trpc/forms.list (authenticated)"
forms_resp=$(trpc_get "forms.list" '{"limit":5}')
if echo "$forms_resp" | grep -q '"items"'; then
  pass "forms.list returned items"
else
  fail "forms.list unexpected: $(echo "$forms_resp" | head -c 200)"
fi

section "9. /trpc/themes.list"
themes_resp=$(curl -s --max-time 15 "$BASE_URL/trpc/themes.list?input=%7B%22json%22%3Anull%7D")
if echo "$themes_resp" | grep -q '"Matrix"'; then
  pass "themes.list returned all 10 themes"
else
  fail "themes.list missing expected theme"
fi

section "10. Create endpoint form (authenticated)"
ep_resp=$(trpc_post "endpoint.create" \
  '{"title":"Smoke test endpoint","websiteUrl":"https://example.test","recipientEmail":"demo@probe.local"}')
EP_ID=$(echo "$ep_resp" | grep -oP '"id"\s*:\s*"[a-f0-9-]{36}"' | head -n1 | cut -d'"' -f4 || true)
EP_KEY=$(echo "$ep_resp" | grep -oP '"accessKey"\s*:\s*"[^"]+"' | head -n1 | cut -d'"' -f4 || true)
if [ -n "$EP_ID" ] && [ -n "$EP_KEY" ]; then
  pass "endpoint.create returned id ($EP_ID) and accessKey"
else
  fail "endpoint.create failed: $(echo "$ep_resp" | head -c 300)"
fi

if [ -n "${EP_KEY:-}" ]; then
  section "11. POST /api/submit — origin allowed → 200"
  submit_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
    -X POST "$BASE_URL/submit" \
    -H "Content-Type: application/json" \
    -H "Origin: https://example.test" \
    -d "{\"access_key\":\"$EP_KEY\",\"name\":\"Smoke Tester\",\"email\":\"test@example.test\",\"message\":\"hello\"}")
  expect_status "Submit with allowed origin" "200" "$submit_status"

  section "12. POST /api/submit — disallowed origin → 403"
  bad_origin=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
    -X POST "$BASE_URL/submit" \
    -H "Content-Type: application/json" \
    -H "Origin: https://attacker.test" \
    -d "{\"access_key\":\"$EP_KEY\",\"name\":\"x\"}")
  expect_status "Submit from disallowed origin" "403" "$bad_origin"

  section "13. POST /api/submit — honeypot tripped → silent 200"
  honey_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
    -X POST "$BASE_URL/submit" \
    -H "Content-Type: application/json" \
    -H "Origin: https://example.test" \
    -d "{\"access_key\":\"$EP_KEY\",\"name\":\"bot\",\"botcheck\":\"x\"}")
  expect_status "Honeypot tripped (silent 200)" "200" "$honey_status"

  section "14. Rotate access key"
  rotate_resp=$(trpc_post "endpoint.rotateKey" "{\"id\":\"$EP_ID\"}")
  if echo "$rotate_resp" | grep -q '"accessKey"'; then
    pass "endpoint.rotateKey returned new key"

    section "15. POST /api/submit with old key → 401"
    old_key_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
      -X POST "$BASE_URL/submit" \
      -H "Content-Type: application/json" \
      -H "Origin: https://example.test" \
      -d "{\"access_key\":\"$EP_KEY\",\"name\":\"x\"}")
    expect_status "Old (rotated) key" "401" "$old_key_status"
  else
    fail "endpoint.rotateKey unexpected: $(echo "$rotate_resp" | head -c 200)"
  fi
fi

section "16. POST /api/submit — invalid access key → 401"
expect_status "Bogus access_key" "401" \
  "$(status -X POST "$BASE_URL/submit" -H "Content-Type: application/json" -d '{"access_key":"totally-bogus-key"}')"

section "17. POST /api/submit — oversize payload → 413"
big=$(python3 -c 'import json; print(json.dumps({"access_key":"x","blob":"a"*100000}))')
big_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  -X POST "$BASE_URL/submit" \
  -H "Content-Type: application/json" \
  --data "$big")
expect_status "Oversize payload" "413" "$big_status"

section "18. Logout"
logout_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "$BASE_URL/api/auth/sign-out" \
  -H "Content-Type: application/json" -H "Origin: $BASE_URL" -d '{}')
expect_status "Logout" "200" "$logout_status"

section "19. auth.me after logout → 401"
expect_status "auth.me without session" "401" \
  "$(status -b "$COOKIE_JAR" "$BASE_URL/trpc/auth.me?input=%7B%22json%22%3Anull%7D")"

printf "\n────────────────────────────────────────\n"
printf "Smoke test: \033[32m%d passed\033[0m, \033[31m%d failed\033[0m\n" "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
