import { z } from "zod";

/**
 * Environment for @repo/services. Mirrors the validation style of the legacy
 * `packages/server/src/env.ts`, scoped to the keys these services actually use
 * (email, rate limiting, captcha, crypto/IP hashing).
 *
 * Anything that may legitimately be absent in dev is `optional()` so simply
 * importing a service module never throws. In particular, Upstash is optional
 * to preserve the "rate limiting disabled" fallback in `lib/ratelimit.ts`.
 */

/**
 * Optional URL secret. Kamal injects an UNSET optional secret as an empty string
 * (`${VAR:-}` → ""), and a pasted value can carry stray whitespace. Plain
 * `z.string().url().optional()` rejects both (an empty string is a *defined*
 * non-URL value, so `.optional()` never applies) — which crashed boot in prod.
 * Treat blank as absent and trim the rest, so an unconfigured optional
 * integration stays "unavailable" instead of failing validation.
 */
const optionalUrl = z
  .preprocess((v) => {
    if (typeof v !== "string") return v;
    const trimmed = v.trim();
    return trimmed === "" ? undefined : trimmed;
  }, z.string().url().optional())
  // Belt-and-suspenders: an OPTIONAL integration must never crash boot. If the
  // value is somehow non-blank yet invalid (a misconfigured secret, an
  // unexpanded `${VAR:-}` literal, etc.), treat the feature as absent rather
  // than throwing — core forms keep working.
  .catch(undefined);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Used as the salt/IKM for IP hashing (lib/ip.ts) and AES-GCM key derivation
  // (lib/crypto.ts). Required — both modules depend on a stable secret.
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be 32+ chars"),

  // Rate limiting (lib/ratelimit.ts). Optional so dev works without Upstash.
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Email (email/index.ts). Optional so sends are skipped when unconfigured.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default("Probe <noreply@riftfi.com>"),

  // Captcha verification endpoints (lib/captcha.ts).
  HCAPTCHA_VERIFY_URL: z.string().url().default("https://hcaptcha.com/siteverify"),
  RECAPTCHA_VERIFY_URL: z
    .string()
    .url()
    .default("https://www.google.com/recaptcha/api/siteverify"),
  TURNSTILE_VERIFY_URL: z
    .string()
    .url()
    .default("https://challenges.cloudflare.com/turnstile/v0/siteverify"),

  // Cloudflare R2 (S3-compatible) for the file_upload field type (lib/storage.ts).
  // ALL optional — absence simply disables file uploads; core forms are
  // unaffected. isStorageConfigured() returns true only when every key is set.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  // Public bucket base URL used to build read/download links in exports + UI.
  R2_PUBLIC_BASE_URL: optionalUrl,

  // Google OAuth for the Sheets integration (lib/integrations.ts). OPTIONAL —
  // when unset, the Sheets integration is "unavailable" and never breaks boot.
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  // Used to derive the Google OAuth redirect URI for token exchange.
  PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

function createEnv(env: NodeJS.ProcessEnv) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    console.error(
      "❌ Invalid environment variables:",
      parsed.error.flatten().fieldErrors,
    );
    throw new Error("Invalid environment");
  }
  return parsed.data;
}

export const env = createEnv(process.env);
