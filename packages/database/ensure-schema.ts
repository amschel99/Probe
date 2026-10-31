/**
 * Idempotent safety net for schema additions, run at boot after `drizzle-kit
 * push`. Push aborts its whole batch on any unrelated diff it can't apply, which
 * can silently leave new columns/tables missing — and Better Auth then fails on
 * every user lookup. These statements are no-ops once the schema is current.
 * Run with: pnpm db:ensure
 */
import "dotenv/config";

import { sql } from "drizzle-orm";

import { db } from "./index";

const STATEMENTS = [
  // AI provider settings (multi-provider AI form generation).
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_provider text`,
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_model text`,
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_base_url text`,
  // Personal API keys for agents.
  sql`CREATE TABLE IF NOT EXISTS api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    prefix text NOT NULL,
    key_hash text NOT NULL UNIQUE,
    last_used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  sql`CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys (user_id)`,
];

async function main() {
  for (const statement of STATEMENTS) await db.execute(statement);
  // A real read of the new columns — fails loudly if anything is still missing.
  await db.execute(sql`SELECT ai_provider, ai_model, ai_base_url FROM users LIMIT 1`);
  await db.execute(sql`SELECT id FROM api_keys LIMIT 1`);
  console.log("✓ Schema additions ensured");
  process.exit(0);
}

main().catch((err) => {
  console.error("Schema ensure failed:", err);
  process.exit(1);
});
