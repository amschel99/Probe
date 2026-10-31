/**
 * Set a new password for an account — for when the owner is locked out.
 * Run with: pnpm reset-password <email> <new-password>
 *
 * Also signs that account out everywhere (deletes its sessions).
 */
import "dotenv/config";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";

import { db } from "./index";
import { accounts, sessions, users } from "./schema";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: pnpm reset-password <email> <new-password>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("The new password must be at least 8 characters.");
    process.exit(1);
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email.trim().toLowerCase()),
  });
  if (!user) {
    console.error(`No account found for ${email}.`);
    process.exit(1);
  }

  // Same hashing Better Auth is configured with (bcrypt, cost 10).
  const hash = await bcrypt.hash(password, 10);

  const credential = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")),
  });
  if (credential) {
    await db.update(accounts).set({ password: hash }).where(eq(accounts.id, credential.id));
  } else {
    await db.insert(accounts).values({
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: hash,
    });
  }

  const ended = await db.delete(sessions).where(eq(sessions.userId, user.id)).returning();
  console.log(`✓ Password updated for ${user.email} (role: ${user.role}).`);
  console.log(`  Signed out ${ended.length} existing session(s). Log in with the new password.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
