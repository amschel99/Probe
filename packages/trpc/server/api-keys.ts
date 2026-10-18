import { createHash, randomBytes } from "node:crypto";

import { db, eq, schema } from "@repo/database";

export const API_KEY_PREFIX = "probe_";

/** New plaintext key + what we persist. The plaintext is never stored. */
export function generateApiKey() {
  const key = `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
  return { key, keyHash: hashApiKey(key), prefix: key.slice(0, API_KEY_PREFIX.length + 4) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Pull a Probe key from `Authorization: Bearer probe_…` or `X-API-Key: probe_…`. */
export function readApiKey(headers: Headers): string | null {
  const auth = headers.get("authorization");
  const bearer = auth?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const key = bearer ?? headers.get("x-api-key")?.trim();
  return key?.startsWith(API_KEY_PREFIX) ? key : null;
}

const TOUCH_INTERVAL_MS = 60_000;

/** Resolve the owning user for a request's API key, or null. */
export async function userFromApiKey(headers: Headers) {
  const key = readApiKey(headers);
  if (!key) return null;

  const row = await db.query.apiKeys.findFirst({
    where: eq(schema.apiKeys.keyHash, hashApiKey(key)),
  });
  if (!row) return null;

  const user = await db.query.users.findFirst({ where: eq(schema.users.id, row.userId) });
  if (!user) return null;

  // Best-effort usage stamp, throttled so hot agents don't write on every call.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    void db
      .update(schema.apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.apiKeys.id, row.id))
      .catch(() => {});
  }
  return user;
}
