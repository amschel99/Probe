import { count, db, eq, schema } from "@repo/database";
import { isEmailConfigured, sendEmail } from "@repo/services/email";
import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { env } from "./env";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Email the reset link — or, with no email provider, print it to the server log. */
async function sendPasswordResetEmail(user: { email: string; name: string }, url: string) {
  if (!isEmailConfigured()) {
    console.warn(`[auth] email not configured — password reset link for ${user.email}: ${url}`);
    return;
  }
  await sendEmail({
    to: user.email,
    subject: "Reset your Probe password",
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;color:#0B0B0C">
        <p>Hi ${escapeHtml(user.name || "there")},</p>
        <p>Someone asked to reset the password for your Probe account. If it was you, choose a new one here:</p>
        <p style="margin:28px 0">
          <a href="${url}" style="background:#1A3BFF;color:#fff;padding:12px 20px;text-decoration:none;font-family:ui-monospace,Menlo,monospace;font-size:14px;display:inline-block">Choose a new password</a>
        </p>
        <p style="color:#56585C;font-size:13px">The link works once and expires in 1 hour. If you didn't ask for this, ignore this email — your password won't change.</p>
      </div>
    `,
  });
}

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
    // Forgot-password flow: POST /api/auth/request-password-reset emails a link
    // that lands on /reset-password?token=…; the new password is set there.
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // Not awaited, so response time doesn't reveal whether the email exists.
      void sendPasswordResetEmail(user, url).catch((err) =>
        console.error("[auth] password reset email failed:", err),
      );
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
