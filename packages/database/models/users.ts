import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { EncryptedSecret } from "./types";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  // User's own AI provider API key for AI form generation, encrypted at rest
  // (AES-256-GCM, same scheme as captcha secrets). The platform never pays for
  // AI — each user brings their own key. Null until they add one in settings.
  aiApiKeyEnc: jsonb("ai_api_key_enc").$type<EncryptedSecret | null>(),
  // Which AI provider/model the key above belongs to. Null provider = Anthropic
  // (keys saved before multi-provider support). aiBaseUrl is only for the
  // admin-only "custom" OpenAI-compatible provider (e.g. a local Ollama).
  aiProvider: text("ai_provider"),
  aiModel: text("ai_model"),
  aiBaseUrl: text("ai_base_url"),
  // Nullable: Better Auth stores credentials in the `accounts` table, not here,
  // so its sign-up flow never sets this. A NOT NULL here makes every new signup
  // fail the insert. The seed sets it for legacy parity; new users rely on
  // `accounts.password`. (Matches the `string | null` type in models/types.ts.)
  passwordHash: text("password_hash"),
  emailVerified: boolean("email_verified").notNull().default(false),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
