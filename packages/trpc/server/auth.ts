import { count, db, eq, schema } from "@repo/database";
import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { env } from "./env";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verification,
    },
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    password: {
      hash: async (password) => bcrypt.hash(password, 10),
      verify: async ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Self-host bootstrap: the first account on a fresh instance becomes
        // the admin, so no seed (and no well-known password) is needed.
        after: async (user) => {
          const [row] = await db.select({ n: count() }).from(schema.users);
          if (row?.n === 1) {
            await db
              .update(schema.users)
              .set({ role: "admin" })
              .where(eq(schema.users.id, user.id));
          }
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  advanced: {
    cookiePrefix: "probe",
    // Cross-subdomain cookies are OPT-IN via COOKIE_DOMAIN (e.g. ".example.com")
    // — only needed if you serve the app and another subdomain that must share
    // the session. Probe is single-origin, so the default (host-only cookies)
    // works on ANY domain, including localhost and self-host installs. Hardcoding
    // a domain here silently breaks auth for anyone not on that exact domain.
    ...(process.env.COOKIE_DOMAIN
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: process.env.COOKIE_DOMAIN,
          },
        }
      : {}),
    useSecureCookies: env.NODE_ENV === "production",
    // Our schema uses Postgres uuid columns with .defaultRandom(). Let the DB
    // generate IDs instead of Better Auth's cuid2 strings.
    database: {
      generateId: false,
    },
  },
});

export type Auth = typeof auth;
