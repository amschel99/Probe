import { z } from "zod";

/** Optional string: blank (how unset secrets arrive from Railway/Kamal) = absent. */
const optional = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be 32+ chars"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),

  // Used to build absolute URLs in notification/verification emails sent from
  // the public/endpoint routers (response notifications, access-key links).
  PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  // Google OAuth for the Sheets integration. OPTIONAL — absence means the
  // Sheets integration is "unavailable" (never breaks boot).
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),

  // Instance-wide AI for form generation. OPTIONAL — when set, every user can
  // generate forms without adding their own key (a user's own key still wins).
  // AI_PROVIDER: anthropic | openai | deepseek | gemini | openrouter | groq |
  // mistral | custom. AI_BASE_URL is only used by `custom`.
  AI_PROVIDER: optional,
  AI_API_KEY: optional,
  AI_MODEL: optional,
  AI_BASE_URL: optional,
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment");
}

export const env = parsed.data;
