import { and, db as defaultDb, eq, schema } from "@repo/database";
import type {
  DiscordIntegrationConfig,
  FormIntegration,
  GoogleConnection,
  GoogleTokens,
  IntegrationType,
  SheetsIntegrationConfig,
} from "@repo/database/schema";
import { logger } from "@repo/logger";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

import { env } from "../env";
import { decryptSecret, encryptSecret } from "./crypto";

type Database = typeof defaultDb;

/** Google OAuth scopes needed for the Sheets integration. */
export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
];

/** The derived OAuth redirect URI (the Express callback route in apps/api). */
export function googleRedirectUri(): string {
  return `${env.PUBLIC_APP_URL}/api/integrations/google/callback`;
}

/**
 * Which integrations are *available* on this deployment. Discord is always
 * available (per-form webhook, no global secret). Sheets requires the Google
 * OAuth client env to be present.
 */
export function integrationAvailability(): Record<IntegrationType, boolean> {
  return {
    discord: true,
    sheets: !!(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET),
  };
}

/** Build an OAuth2 client. Returns null when Sheets isn't configured. */
export function googleOAuthClient(): OAuth2Client | null {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) return null;
  return new google.auth.OAuth2(
    env.GOOGLE_OAUTH_CLIENT_ID,
    env.GOOGLE_OAUTH_CLIENT_SECRET,
    googleRedirectUri(),
  );
}

/** Read the platform-wide enabled flag for an integration key. */
async function isPlatformEnabled(db: Database, type: IntegrationType): Promise<boolean> {
  const row = await db.query.platformSettings.findFirst({
    where: eq(schema.platformSettings.key, `integration:${type}`),
  });
  return !!(row?.value as { enabled?: boolean } | undefined)?.enabled;
}

interface DeliveryField {
  id: string;
  label: string;
}

interface DeliverArgs {
  db: Database;
  formId: string;
  formTitle: string;
  /** Field definitions (id + label) so we can label values nicely. */
  fields: DeliveryField[];
  /** Submitted values keyed by field id (or arbitrary key for endpoint forms). */
  values: Record<string, unknown>;
}

/** Render a single value to a flat string for display. */
function valueToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map((x) => valueToString(x)).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * Build [label, value] pairs for delivery. Uses field labels where a value's
 * key matches a known field id; otherwise falls back to the raw key (endpoint
 * forms submit arbitrary keys).
 */
function buildRows(
  fields: DeliveryField[],
  values: Record<string, unknown>,
): Array<[string, string]> {
  const labelById = new Map(fields.map((f) => [f.id, f.label]));
  return Object.entries(values)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([key, v]) => [labelById.get(key) ?? key, valueToString(v)] as [string, string]);
}

/* -------------------------------------------------------------------------- */
/* Discord                                                                    */
/* -------------------------------------------------------------------------- */

async function deliverDiscord(args: DeliverArgs, config: DiscordIntegrationConfig) {
  const rows = buildRows(args.fields, args.values);
  const embedFields = rows.slice(0, 25).map(([name, value]) => ({
    name: name.slice(0, 256) || "—",
    value: (value || "—").slice(0, 1024),
    inline: false,
  }));

  const body = {
    username: "Probe",
    embeds: [
      {
        title: `New response · ${args.formTitle}`.slice(0, 256),
        color: 0xb8722e,
        fields: embedFields,
        timestamp: new Date().toISOString(),
        footer: { text: "Probe" },
      },
    ],
  };

  const res = await fetch(config.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Discord webhook responded ${res.status}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Google Sheets                                                              */
/* -------------------------------------------------------------------------- */

/** Decrypt the stored Google tokens for a connection row. */
function decodeTokens(conn: GoogleConnection): GoogleTokens {
  return JSON.parse(decryptSecret(conn.tokensEnc)) as GoogleTokens;
}

/**
 * Return an authed OAuth2 client for the connection, refreshing + persisting
 * the access token if it's near expiry. Returns null when Sheets isn't
 * configured on this deployment.
 */
export async function authedGoogleClientForUser(
  db: Database,
  userId: string,
): Promise<OAuth2Client | null> {
  const oauth = googleOAuthClient();
  if (!oauth) return null;
  const conn = await db.query.googleConnections.findFirst({
    where: eq(schema.googleConnections.userId, userId),
  });
  if (!conn) return null;

  const tokens = decodeTokens(conn);
  oauth.setCredentials({
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  });

  // Refresh if expired (or expiring within 60s) and we hold a refresh token.
  const expired =
    !tokens.expiry_date || tokens.expiry_date - Date.now() < 60_000;
  if (expired && tokens.refresh_token) {
    try {
      const { credentials } = await oauth.refreshAccessToken();
      oauth.setCredentials(credentials);
      const merged: GoogleTokens = {
        access_token: credentials.access_token ?? tokens.access_token,
        // Google omits the refresh_token on refresh — keep the existing one.
        refresh_token: credentials.refresh_token ?? tokens.refresh_token,
        expiry_date: credentials.expiry_date ?? tokens.expiry_date,
      };
      await db
        .update(schema.googleConnections)
        .set({ tokensEnc: encryptSecret(JSON.stringify(merged)) })
        .where(eq(schema.googleConnections.userId, userId));
    } catch (err) {
      logger.error(`[integrations] Google token refresh failed: ${(err as Error).message}`);
      throw err;
    }
  }

  return oauth;
}

async function deliverSheets(
  args: DeliverArgs,
  config: SheetsIntegrationConfig,
  ownerUserId: string,
) {
  const oauth = await authedGoogleClientForUser(args.db, ownerUserId);
  if (!oauth) {
    throw new Error("No Google connection for form owner");
  }

  const sheetsApi = google.sheets({ version: "v4", auth: oauth });
  const rows = buildRows(args.fields, args.values);

  // Append a row: timestamp + one cell per submitted value. (We don't manage a
  // header row — the owner sets up their own headers in the target sheet.)
  const valueRow = [new Date().toISOString(), ...rows.map(([, value]) => value)];

  await sheetsApi.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range: config.sheetName,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [valueRow] },
  });
}

/* -------------------------------------------------------------------------- */
/* Orchestration                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Deliver a persisted response to every per-form integration that is BOTH
 * platform-enabled AND configured (row enabled). Each delivery is wrapped in
 * its own try/catch and logged — a failure NEVER throws, so this can be called
 * fire-and-forget after a response is saved without ever blocking the 200.
 */
export async function deliverResponseToIntegrations(args: DeliverArgs): Promise<void> {
  const db = args.db;
  try {
    const integrations: FormIntegration[] = await db.query.formIntegrations.findMany({
      where: and(
        eq(schema.formIntegrations.formId, args.formId),
        eq(schema.formIntegrations.enabled, true),
      ),
    });
    if (integrations.length === 0) return;

    // Resolve the form owner once (needed for Sheets).
    const form = await db.query.forms.findFirst({
      where: eq(schema.forms.id, args.formId),
      columns: { userId: true },
    });

    const availability = integrationAvailability();

    for (const integration of integrations) {
      const type = integration.type;
      try {
        if (!availability[type]) continue;
        const platformOn = await isPlatformEnabled(db, type);
        if (!platformOn) continue;

        if (type === "discord") {
          await deliverDiscord(args, integration.config as DiscordIntegrationConfig);
        } else if (type === "sheets") {
          if (!form) continue;
          await deliverSheets(
            args,
            integration.config as SheetsIntegrationConfig,
            form.userId,
          );
        }
      } catch (err) {
        logger.error(
          `[integrations] delivery failed (type=${type}, form=${args.formId}): ${
            (err as Error).message
          }`,
        );
      }
    }
  } catch (err) {
    logger.error(
      `[integrations] failed to load integrations for form ${args.formId}: ${
        (err as Error).message
      }`,
    );
  }
}
