/**
 * Seed entry. Reproducible because faker.seed(42).
 * Run with: pnpm db:seed
 *
 * Idempotent: wipes user-owned data for the demo users, re-seeds it.
 * Themes are upserted by slug.
 */

import "dotenv/config";

import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";

import { db } from "../index";
import {
  accounts as accountsTable,
  analyticsEvents,
  fields as fieldsTable,
  forms as formsTable,
  responses,
  responseValues,
  users as usersTable,
} from "../schema";
import type {
  AnalyticsEventType,
  FieldType,
  ResponseValue,
  SelectOption,
} from "../models/types";
import { SEED_FORMS, type SeedField, type SeedForm } from "./forms";
import { upsertThemes } from "./upsert-themes";

faker.seed(42);

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

const DEMO_EMAIL = "demo@probe.local";
const DEMO_PASSWORD = "Probe@2025";
const DEMO_NAME = "Demo User";

const ADMIN_EMAIL = "admin@probe.local";
const ADMIN_PASSWORD = "ProbeAdmin@2025";
const ADMIN_NAME = "Demo Admin";

async function ensureUser(opts: {
  email: string;
  password: string;
  name: string;
  role: "user" | "admin";
}) {
  const { email, password, name, role } = opts;
  const existing = await db.query.users.findFirst({
    where: eq(usersTable.email, email),
  });
  const passwordHash = await bcrypt.hash(password, 10); // Better Auth defaults to cost 10
  if (existing) {
    // Keep the role in sync on re-seed.
    if (existing.role !== role) {
      await db.update(usersTable).set({ role }).where(eq(usersTable.id, existing.id));
    }
    // Make sure the credential row exists too
    const cred = await db.query.accounts.findFirst({
      where: eq(accountsTable.userId, existing.id),
    });
    if (!cred) {
      await db.insert(accountsTable).values({
        userId: existing.id,
        accountId: existing.id,
        providerId: "credential",
        password: passwordHash,
      });
    }
    return { ...existing, role };
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      email,
      name,
      passwordHash,
      emailVerified: true,
      role,
    })
    .returning();
  if (!user) throw new Error(`Failed to create user ${email}`);

  await db.insert(accountsTable).values({
    userId: user.id,
    accountId: user.id,
    providerId: "credential",
    password: passwordHash,
  });
  return user;
}

async function clearDemoForms(userId: string) {
  // forms cascade delete fields → response_values → responses → analytics
  await db.delete(formsTable).where(eq(formsTable.userId, userId));
}

function fakeValueForField(seed: SeedField): ResponseValue {
  switch (seed.type as FieldType) {
    case "short_text":
      return faker.person.fullName();
    case "long_text":
      return faker.lorem.paragraph({ min: 1, max: 3 });
    case "email":
      return faker.internet.email().toLowerCase();
    case "number": {
      const cfg = seed.config as { min?: number; max?: number };
      const min = cfg.min ?? 0;
      const max = cfg.max ?? 1000;
      return faker.number.int({ min, max });
    }
    case "single_select": {
      const opts = (seed.config.options ?? []) as SelectOption[];
      if (opts.length === 0) return "";
      const picked = opts[faker.number.int({ min: 0, max: opts.length - 1 })];
      return picked?.value ?? "";
    }
    case "multi_select": {
      const opts = (seed.config.options ?? []) as SelectOption[];
      if (opts.length === 0) return [];
      const count = faker.number.int({ min: 1, max: Math.min(3, opts.length) });
      return faker.helpers.arrayElements(opts, count).map((o) => o.value);
    }
    case "checkbox":
      return faker.datatype.boolean();
    case "rating": {
      const max = (seed.config.maxRating as number | undefined) ?? 5;
      return faker.number.int({ min: 1, max });
    }
    case "date":
      return faker.date.recent({ days: 30 }).toISOString();
    case "phone":
      return faker.phone.number();
    case "url":
      return faker.internet.url();
    default:
      return "";
  }
}

async function seedFormWithResponses(opts: {
  seed: SeedForm;
  themeId: string;
  userId: string;
}) {
  const { seed, themeId, userId } = opts;

  const slug = `${seed.slug}-${nanoid()}`;

  const [form] = await db
    .insert(formsTable)
    .values({
      slug,
      userId,
      themeId,
      title: seed.title,
      description: seed.description,
      status: "published",
      visibility: seed.visibility,
      settings: seed.settings,
      responseCount: seed.responseCount,
      viewCount: seed.responseCount * faker.number.int({ min: 2, max: 5 }),
      publishedAt: faker.date.recent({ days: 60 }),
    })
    .returning();
  if (!form) throw new Error("Failed to insert form");

  const insertedFields = await db
    .insert(fieldsTable)
    .values(
      seed.fields.map((f) => ({
        formId: form.id,
        type: f.type,
        label: f.label,
        placeholder: f.placeholder,
        helpText: f.helpText,
        required: f.required,
        order: f.order,
        config: f.config,
      })),
    )
    .returning();

  const fieldByKey = new Map<string, (typeof insertedFields)[number]>();
  insertedFields.forEach((f, i) => {
    const seedField = seed.fields[i];
    if (seedField) fieldByKey.set(seedField.key, f);
  });

  // Fake responses + their values
  for (let i = 0; i < seed.responseCount; i++) {
    const createdAt = faker.date.recent({ days: 30 });
    const [response] = await db
      .insert(responses)
      .values({
        formId: form.id,
        submitterEmail: faker.helpers.maybe(() => faker.internet.email(), {
          probability: 0.6,
        }),
        submitterName: faker.helpers.maybe(() => faker.person.fullName(), {
          probability: 0.4,
        }),
        ipHash: faker.string.alphanumeric(32),
        userAgent: faker.internet.userAgent(),
        country: faker.location.countryCode(),
        completionTime: faker.number.int({ min: 8_000, max: 180_000 }),
        createdAt,
      })
      .returning();
    if (!response) continue;

    const valuesToInsert = seed.fields
      .map((f) => {
        const fieldRow = fieldByKey.get(f.key);
        if (!fieldRow) return null;
        // Optional fields: sometimes blank
        if (!f.required && faker.datatype.boolean({ probability: 0.2 })) {
          return null;
        }
        return {
          responseId: response.id,
          fieldId: fieldRow.id,
          value: fakeValueForField(f),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (valuesToInsert.length > 0) {
      await db.insert(responseValues).values(valuesToInsert);
    }
  }

  // Analytics events: views/starts/submits/abandons
  const events: { event: AnalyticsEventType; count: number }[] = [
    { event: "view", count: seed.responseCount * 4 },
    { event: "start", count: Math.round(seed.responseCount * 1.6) },
    { event: "submit", count: seed.responseCount },
    { event: "abandon", count: Math.round(seed.responseCount * 0.6) },
  ];

  const eventRows = events.flatMap(({ event, count }) =>
    Array.from({ length: count }).map(() => {
      const metadata =
        event === "abandon"
          ? {
              fieldId:
                faker.helpers.arrayElement(insertedFields)?.id ?? null,
            }
          : null;
      return {
        formId: form.id,
        event,
        metadata,
        createdAt: faker.date.recent({ days: 30 }),
      };
    }),
  );

  if (eventRows.length > 0) {
    // Chunk insert — analytics events can balloon
    const CHUNK = 500;
    for (let i = 0; i < eventRows.length; i += CHUNK) {
      await db.insert(analyticsEvents).values(eventRows.slice(i, i + CHUNK));
    }
  }

  return form;
}

async function main() {
  console.log("🔎 Probe seed — loading demo data…");

  const allThemes = await upsertThemes();
  console.log(`  ✓ Themes upserted (${allThemes.length})`);

  const user = await ensureUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    name: DEMO_NAME,
    role: "user",
  });
  console.log(`  ✓ Demo user ready: ${user.email}`);

  const admin = await ensureUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    name: ADMIN_NAME,
    role: "admin",
  });
  console.log(`  ✓ Admin user ready: ${admin.email}`);

  await clearDemoForms(user.id);
  console.log("  ✓ Cleared existing demo forms (cascade)");

  for (const seed of SEED_FORMS) {
    const theme = allThemes.find((t) => t.slug === seed.themeSlug);
    if (!theme) throw new Error(`Missing theme: ${seed.themeSlug}`);
    const form = await seedFormWithResponses({
      seed,
      themeId: theme.id,
      userId: user.id,
    });
    console.log(`  ✓ Seeded "${seed.title}" → /f/${form.slug} (${seed.responseCount} responses)`);
  }

  // Quick stats
  const stats = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(formsTable);
  console.log(`Done. Total forms in DB: ${stats[0]?.count ?? 0}`);

  console.log("\n🔐 Demo logins:");
  console.log(`  • User : ${DEMO_EMAIL} / ${DEMO_PASSWORD}  (role: user)`);
  console.log(`  • Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}  (role: admin)`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
