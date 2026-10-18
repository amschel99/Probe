import "dotenv/config";

import { createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

import express, { type Request, type Response as ExpressResponse } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";

import * as trpcExpress from "@trpc/server/adapters/express";
import { generateOpenApiDocument, createOpenApiExpressMiddleware } from "trpc-to-openapi";
import { apiReference } from "@scalar/express-api-reference";

import { logger } from "@repo/logger";
import { serverRouter, createContext, auth, userFromApiKey } from "@repo/trpc/server";
import { db, schema, eq, sql } from "@repo/database";
import {
  sendEmail,
  senderAddress,
  verifyCaptcha,
  decryptSecret,
  deliverResponseToIntegrations,
  encryptSecret,
  getClientIp,
  hashIp,
  originAllowed,
  submitLimiter,
  buildExportDataset,
  type ExportDataset,
  type ExportFilters,
} from "@repo/services";
import { google } from "googleapis";

import { env } from "./env";

/** Build the OAuth2 client used by the Google callback. Null when unconfigured. */
function googleOAuthClient() {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) return null;
  return new google.auth.OAuth2(
    env.GOOGLE_OAUTH_CLIENT_ID,
    env.GOOGLE_OAUTH_CLIENT_SECRET,
    `${env.PUBLIC_APP_URL}/api/integrations/google/callback`,
  );
}

export const app = express();

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Build a Web `Headers` object from Express-style `req.headers`. Better Auth's
 * `getSession` and a few other helpers want a Fetch `Headers`, not the Node
 * `IncomingHttpHeaders` shape.
 */
function toWebHeaders(reqHeaders: Request["headers"]): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(reqHeaders)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }
  return headers;
}

/**
 * Adapt an Express `req` to the `{ header(name): string | undefined }` shape
 * that `getClientIp` expects (Hono-style accessor).
 */
function headerReadable(req: Request): { header(name: string): string | undefined } {
  return {
    header(name: string) {
      const v = req.headers[name.toLowerCase()];
      if (Array.isArray(v)) return v[0];
      return v;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* 1. Better Auth — MUST be mounted before express.json (needs the raw body)  */
/* -------------------------------------------------------------------------- */
// The web app calls auth at same-origin /api/auth/* (proxied to this app in
// prod), matching the old Hono mount at /api/auth/*.
app.all("/api/auth/*", toNodeHandler(auth));

/* -------------------------------------------------------------------------- */
/* 2. CORS                                                                    */
/* -------------------------------------------------------------------------- */
// In non-production, allow the web origin (with credentials) for everything.
if (env.NODE_ENV !== "production") {
  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
    }),
  );
}

// The /submit endpoint is cross-origin by design — reflect the request origin
// in ALL environments (replicates the per-route CORS scoping from the old Hono
// app where `/submit` had its own permissive `cors({ origin: "*" })`).
app.use(
  "/submit",
  cors({
    origin: true,
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
    maxAge: 86400,
  }),
);

/* -------------------------------------------------------------------------- */
/* 3. Public endpoint-form submission — POST /submit                          */
/* -------------------------------------------------------------------------- */
// Registered BEFORE the global express.json so it can enforce its own hard
// byte cap on the raw stream (a header-only check is forgeable via chunked
// transfer). The capped reader mirrors the old Hono `readBodyCapped`.

const MAX_BODY_BYTES = 64 * 1024;
const MAX_FIELDS = 50;

type SubmitErrorStatus = 400 | 401 | 403 | 413 | 422 | 429 | 500;

function submitJsonError(
  res: ExpressResponse,
  status: SubmitErrorStatus,
  code: string,
  message: string,
) {
  return res.status(status).json({ success: false, code, message });
}

/**
 * Read the request body into memory with a HARD byte cap, enforced on the
 * actual bytes streamed — not on the Content-Length header, which a client
 * can omit (chunked transfer) or lie about. Returns null if the cap is
 * exceeded, so an attacker can't exhaust memory with an unbounded body.
 */
function readBodyCapped(req: Request, max: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;
    const done = (val: Buffer | null) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };
    req.on("data", (chunk: Buffer) => {
      total += chunk.byteLength;
      if (total > max) {
        // Stop consuming; an unbounded body must never fill memory.
        req.destroy();
        done(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => done(Buffer.concat(chunks)));
    req.on("error", () => done(null));
    req.on("aborted", () => done(null));
  });
}

async function readPayload(req: Request): Promise<Record<string, unknown> | null> {
  const ct = req.headers["content-type"] ?? "";
  // Fast reject if the declared length already exceeds the cap…
  const cl = Number(req.headers["content-length"] ?? "0");
  if (cl > MAX_BODY_BYTES) return null;
  // …but the real gate is the actual byte count, capped while streaming.
  const raw = await readBodyCapped(req, MAX_BODY_BYTES);
  if (raw === null) return null;

  try {
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      // Re-wrap the buffered bytes so the platform parser handles the encoding.
      const form = await new Response(raw as unknown as ArrayBuffer, {
        headers: { "content-type": ct },
      }).formData();
      const obj: Record<string, unknown> = {};
      for (const [k, v] of form.entries()) {
        if (typeof v === "string") {
          obj[k] = obj[k] !== undefined ? ([] as string[]).concat(obj[k] as string, v) : v;
        }
        // File parts are ignored — endpoint forms don't accept uploads.
      }
      return obj;
    }
    // JSON (and text fallback): decode then parse.
    const text = raw.toString("utf8");
    if (!text.trim()) return {};
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function renderSubjectTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(form_name|submitter_email|submitter_name)\}/g, (_m, key) => {
    return vars[key] ?? "";
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPayloadHtml(payload: Record<string, unknown>): string {
  const rows = Object.entries(payload)
    .filter(
      ([k]) =>
        ![
          "access_key",
          "botcheck",
          "h-captcha-response",
          "g-recaptcha-response",
          "cf-turnstile-response",
          "redirect",
        ].includes(k),
    )
    .map(([k, v]) => {
      const val =
        Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
      return `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;font-weight:600">${escapeHtml(k)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(val)}</td></tr>`;
    })
    .join("");
  return `<table style="border-collapse:collapse;width:100%;font-family:system-ui,sans-serif">${rows}</table>`;
}

async function submitHandler(req: Request, res: ExpressResponse) {
  const payload = await readPayload(req);
  if (payload === null)
    return submitJsonError(res, 413, "PAYLOAD_TOO_LARGE", "Body too large or unparseable");
  if (Object.keys(payload).length > MAX_FIELDS) {
    return submitJsonError(res, 400, "TOO_MANY_FIELDS", `Maximum ${MAX_FIELDS} fields`);
  }

  const access_key = typeof payload.access_key === "string" ? payload.access_key : null;
  if (!access_key) return submitJsonError(res, 400, "INVALID_INPUT", "access_key is required");

  // Lookup the form (and verify it's an endpoint form)
  const form = await db.query.forms.findFirst({
    where: eq(schema.forms.accessKey, access_key),
  });
  if (!form || form.type !== "endpoint") {
    return submitJsonError(res, 401, "INVALID_ACCESS_KEY", "Unknown access key");
  }

  // Origin / Referer allowlist
  const origin = (req.headers.origin as string | undefined) ?? undefined;
  const referer = req.headers.referer as string | undefined;
  const settings = form.endpointSettings;

  if (!origin && referer) {
    try {
      const url = new URL(referer);
      const synth = `${url.protocol}//${url.host}`;
      if (!originAllowed(synth, form.allowedOrigins)) {
        return submitJsonError(res, 403, "ORIGIN_NOT_ALLOWED", "Origin not in allowlist");
      }
    } catch {
      return submitJsonError(res, 403, "ORIGIN_NOT_ALLOWED", "Origin not in allowlist");
    }
  } else if (!origin && !referer) {
    // Server-to-server submission — only allowed when explicitly opted in
    if (!settings?.allowServerSide) {
      return submitJsonError(res, 403, "ORIGIN_NOT_ALLOWED", "Server-side submissions not enabled");
    }
  } else if (origin && !originAllowed(origin, form.allowedOrigins)) {
    return submitJsonError(res, 403, "ORIGIN_NOT_ALLOWED", "Origin not in allowlist");
  }

  // Rate limit by IP + form
  const ip = getClientIp(headerReadable(req));
  const { success, limit, remaining, reset } = await submitLimiter.limit(`submit:${form.id}:${ip}`);
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset", String(reset));
  if (!success) return submitJsonError(res, 429, "RATE_LIMITED", "Too many submissions — slow down");

  // Honeypot — silently accept + drop
  const honeypot = payload.botcheck;
  const honeypotTripped =
    settings?.honeypotEnabled !== false &&
    honeypot !== undefined &&
    honeypot !== "" &&
    honeypot !== false &&
    honeypot !== "false" &&
    honeypot !== "0";
  if (honeypotTripped) {
    return res.status(200).json({ success: true, message: "Submission received" });
  }

  // Captcha
  if (settings?.captchaProvider && settings.captchaProvider !== "none") {
    const tokenField =
      settings.captchaProvider === "hcaptcha"
        ? "h-captcha-response"
        : settings.captchaProvider === "turnstile"
          ? "cf-turnstile-response"
          : "g-recaptcha-response";
    const token = payload[tokenField] as string | undefined;
    const secret = settings.captchaSecret ? decryptSecret(settings.captchaSecret) : null;
    const ok = await verifyCaptcha({
      provider: settings.captchaProvider,
      secret,
      token,
      remoteIp: ip,
    });
    if (!ok) return submitJsonError(res, 422, "SPAM_REJECTED", "Captcha verification failed");
  }

  // Build the persisted payload — strip out control fields
  const persisted: Record<string, unknown> = { ...payload };
  delete persisted.access_key;
  delete persisted.botcheck;
  delete persisted["h-captcha-response"];
  delete persisted["g-recaptcha-response"];
  delete persisted["cf-turnstile-response"];
  delete persisted.redirect;

  const submitterEmail =
    typeof payload.email === "string" && payload.email.includes("@") ? payload.email : null;
  const submitterName = typeof payload.from_name === "string" ? payload.from_name : null;
  const ipHash = hashIp(ip);
  const userAgent = (req.headers["user-agent"] as string | undefined)?.slice(0, 500) ?? null;

  // Verified? If not, store the submission but don't email anyone.
  const verified = !!form.accessKeyVerifiedAt;

  await db.transaction(async (tx) => {
    await tx.insert(schema.responses).values({
      formId: form.id,
      submissionType: "endpoint",
      submitterEmail,
      submitterName,
      ipHash,
      userAgent,
      payload: persisted,
    });
    await tx
      .update(schema.forms)
      .set({
        responseCount: sql`${schema.forms.responseCount} + 1`,
        lastSubmittedAt: new Date(),
      })
      .where(eq(schema.forms.id, form.id));
  });

  // Deliver to per-form integrations (Discord / Sheets) — NON-BLOCKING. Endpoint
  // forms submit arbitrary keys (no field defs), so values are labelled by key.
  void deliverResponseToIntegrations({
    db,
    formId: form.id,
    formTitle: form.title,
    fields: [],
    values: persisted,
  }).catch((err) => logger.error(`[submit] integration delivery failed: ${err}`));

  if (verified && form.recipientEmail) {
    const subjectVars = {
      form_name: form.title,
      submitter_email: submitterEmail ?? "",
      submitter_name: submitterName ?? "",
    };
    const subject =
      typeof payload.subject === "string" && payload.subject.length > 0
        ? payload.subject
        : renderSubjectTemplate(
            settings?.subjectTemplate ?? "New submission from {form_name}",
            subjectVars,
          );

    const html = `
      <p>You received a new submission via <strong>${escapeHtml(form.title)}</strong>:</p>
      ${renderPayloadHtml(persisted)}
      <p style="margin-top:24px;color:#888;font-size:12px">— Probe</p>
    `;

    const recipients = [form.recipientEmail, ...(settings?.notifyEmails ?? [])];
    Promise.all(
      recipients.map((to) =>
        sendEmail({
          to,
          subject,
          html,
          from: submitterEmail
            ? `${submitterName ?? "Probe"} <${senderAddress()}>`
            : undefined,
        }),
      ),
    ).catch((err) => console.error("[submit] email send failed:", err));

    // Webhook
    if (settings?.webhookUrl && settings.webhookSigningSecret) {
      const body = JSON.stringify({ formId: form.id, formTitle: form.title, payload: persisted });
      const signature = createHmac("sha256", settings.webhookSigningSecret).update(body).digest("hex");
      fetch(settings.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Probe-Signature": `sha256=${signature}`,
          "User-Agent": "Probe-Webhook/1.0",
        },
        body,
      }).catch((err) => console.error("[submit] webhook delivery failed:", err));
    }
  }

  // Redirect — only if origin matches allowlist
  const redirect = typeof payload.redirect === "string" ? payload.redirect : null;
  if (redirect) {
    try {
      const target = new URL(redirect);
      const targetOrigin = `${target.protocol}//${target.host}`;
      if (!originAllowed(targetOrigin, form.allowedOrigins)) {
        return submitJsonError(res, 400, "INVALID_REDIRECT", "Redirect origin not in allowlist");
      }
      return res.redirect(303, redirect);
    } catch {
      return submitJsonError(res, 400, "INVALID_REDIRECT", "Redirect URL invalid");
    }
  }

  return res.status(200).json({
    success: true,
    message: verified
      ? "Submission received"
      : "Submission received. Recipient hasn't verified yet — visible in dashboard, no email sent.",
  });
}

// Mounted here (before the global express.json below) so submitHandler owns
// the raw request stream and can enforce its byte cap.
app.post("/submit", (req, res) => {
  submitHandler(req, res).catch((err) => {
    console.error("[submit] unhandled error:", err);
    if (!res.headersSent) submitJsonError(res, 500, "INTERNAL_SERVER_ERROR", "Something went wrong");
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Body parsing — AFTER auth + submit (both consume the raw body)          */
/* -------------------------------------------------------------------------- */
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

/* -------------------------------------------------------------------------- */
/* 5. Health                                                                  */
/* -------------------------------------------------------------------------- */
app.get("/", (_req, res) => {
  return res.json({ name: "probe-api", status: "ok" });
});

app.get("/health", (_req, res) => {
  return res.json({ ok: true, ts: new Date().toISOString() });
});

/* -------------------------------------------------------------------------- */
/* 6. Recipient verification link — GET|POST /verify-access-key/:token        */
/* -------------------------------------------------------------------------- */
async function verifyAccessKeyHandler(req: Request, res: ExpressResponse) {
  const token = req.params.token;

  const page = (heading: string, body: string, status: 200 | 400 | 404 = 200) => {
    res.status(status).type("html").send(
      `<!doctype html><html><head><meta charset="utf-8"><title>${heading} — Probe</title>
      <style>
        body { font: 16px/1.5 system-ui, sans-serif; background:#FBF5EC; color:#3B2A1A; display:flex; min-height:100vh; align-items:center; justify-content:center; padding:24px; margin:0; }
        .card { background:#fff; padding:48px; border-radius:16px; max-width:480px; box-shadow:0 8px 32px rgba(0,0,0,0.08); text-align:center }
        h1 { margin:0 0 16px; font-family: 'Lora', Georgia, serif; }
        a { color:#B8722E }
      </style></head><body><div class="card"><h1>${heading}</h1>${body}</div></body></html>`,
    );
  };

  if (!token)
    return page(
      "Link not found",
      `<p>This verification link is missing its token. <a href="${env.PUBLIC_APP_URL}">Go to Probe</a></p>`,
      404,
    );

  const ver = await db.query.accessKeyVerifications.findFirst({
    where: eq(schema.accessKeyVerifications.token, token),
  });

  if (!ver)
    return page(
      "Link not found",
      `<p>This verification link doesn't exist. <a href="${env.PUBLIC_APP_URL}">Go to Probe</a></p>`,
      404,
    );
  if (ver.usedAt)
    return page("Already verified", `<p>This link was already used. Submissions are flowing.</p>`, 200);
  if (ver.expiresAt < new Date())
    return page(
      "Link expired",
      `<p>This verification link has expired. Open your endpoint form in Probe and click <strong>Resend verification</strong>.</p>`,
      400,
    );

  await db.transaction(async (tx) => {
    await tx
      .update(schema.accessKeyVerifications)
      .set({ usedAt: new Date() })
      .where(eq(schema.accessKeyVerifications.id, ver.id));
    await tx
      .update(schema.forms)
      .set({ accessKeyVerifiedAt: new Date(), recipientEmail: ver.recipientEmail })
      .where(eq(schema.forms.id, ver.formId));
    await tx.insert(schema.endpointAudit).values({
      formId: ver.formId,
      actorId: null,
      action: "verified",
      detail: { recipient: ver.recipientEmail },
    });
  });

  return page(
    "Verified ✓",
    `<p>You'll now receive submissions at <strong>${ver.recipientEmail}</strong>.</p><p style="margin-top:24px"><a href="${env.PUBLIC_APP_URL}/dashboard/endpoint-forms">Go to dashboard</a></p>`,
    200,
  );
}

app.get("/verify-access-key/:token", (req, res) => {
  verifyAccessKeyHandler(req, res).catch((err) => {
    console.error("[verify-access-key] unhandled error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal error" });
  });
});
app.post("/verify-access-key/:token", (req, res) => {
  verifyAccessKeyHandler(req, res).catch((err) => {
    console.error("[verify-access-key] unhandled error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal error" });
  });
});

/* -------------------------------------------------------------------------- */
/* 6b. Google OAuth callback — GET /api/integrations/google/callback          */
/*     Exchanges the code for tokens, stores them encrypted, redirects back.  */
/* -------------------------------------------------------------------------- */
async function googleCallbackHandler(req: Request, res: ExpressResponse) {
  const settingsUrl = `${env.PUBLIC_APP_URL}/dashboard/settings`;

  const oauth = googleOAuthClient();
  if (!oauth) {
    return res.redirect(`${settingsUrl}?google=unconfigured`);
  }

  const code = typeof req.query.code === "string" ? req.query.code : null;
  // `state` carries the user id we attached when building the consent URL.
  const userId = typeof req.query.state === "string" ? req.query.state : null;
  const oauthError = typeof req.query.error === "string" ? req.query.error : null;

  if (oauthError || !code || !userId) {
    return res.redirect(`${settingsUrl}?google=error`);
  }

  // Confirm the user still exists (and to avoid a dangling FK insert).
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { id: true },
  });
  if (!user) {
    return res.redirect(`${settingsUrl}?google=error`);
  }

  const { tokens } = await oauth.getToken(code);
  oauth.setCredentials(tokens);

  // Best-effort: resolve the connected Google email for display.
  let googleEmail: string | null = null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: oauth });
    const me = await oauth2.userinfo.get();
    googleEmail = me.data.email ?? null;
  } catch (err) {
    logger.warn(`[google-callback] could not fetch userinfo: ${(err as Error).message}`);
  }

  const tokensEnc = encryptSecret(
    JSON.stringify({
      access_token: tokens.access_token ?? null,
      refresh_token: tokens.refresh_token ?? null,
      expiry_date: tokens.expiry_date ?? null,
    }),
  );

  await db
    .insert(schema.googleConnections)
    .values({ userId, tokensEnc, googleEmail })
    .onConflictDoUpdate({
      target: schema.googleConnections.userId,
      set: { tokensEnc, googleEmail, updatedAt: new Date() },
    });

  return res.redirect(`${settingsUrl}?google=connected`);
}

app.get("/api/integrations/google/callback", (req, res) => {
  googleCallbackHandler(req, res).catch((err) => {
    console.error("[google-callback] unhandled error:", err);
    if (!res.headersSent) {
      res.redirect(`${env.PUBLIC_APP_URL}/dashboard/settings?google=error`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 7. Authenticated response exports (CSV / XLSX / PDF)                       */
/*    GET /forms/:formId/export.{csv,xlsx,pdf}?from=&to= — session + owner    */
/* -------------------------------------------------------------------------- */
type Format = "csv" | "xlsx" | "pdf";

const CONTENT_TYPE: Record<Format, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

function csvEscape(value: string | number | null): string {
  if (value === null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function toCsv(ds: ExportDataset): string {
  const lines = [ds.columns.map(csvEscape).join(",")];
  for (const row of ds.rows) lines.push(row.map(csvEscape).join(","));
  // Prepend a UTF-8 BOM so Excel opens it in the right encoding.
  return "﻿" + lines.join("\r\n");
}

async function toXlsx(ds: ExportDataset): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Probe";
  wb.created = ds.generatedAt;
  const ws = wb.addWorksheet("Responses", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = ds.columns.map((c) => ({
    header: c,
    width: Math.min(Math.max(c.length + 4, 14), 50),
  }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFB8722E" },
  };
  for (const row of ds.rows) {
    ws.addRow(row.map((v) => (v === null ? "" : v)));
  }
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(ds.columns.length, 1) },
  };
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

// pdf-lib's StandardFonts only encode Latin-1; drop anything outside it
// (emoji, CJK, …) so a stray character can't crash the whole export.
function pdfSafe(s: string): string {
  return s.replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "?");
}

async function toPdf(ds: ExportDataset): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const accent = rgb(0.72, 0.45, 0.18);
  const ink = rgb(0.16, 0.13, 0.1);
  const muted = rgb(0.45, 0.42, 0.38);

  const MARGIN = 48;
  const PAGE = [595.28, 841.89] as const; // A4 portrait
  let page = doc.addPage([...PAGE]);
  let { width, height } = page.getSize();
  let y = height - MARGIN;

  const wrap = (text: string, size: number, f: typeof font, maxW: number): string[] => {
    const words = pdfSafe(text).split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  };

  const ensure = (need: number) => {
    if (y - need < MARGIN) {
      page = doc.addPage([...PAGE]);
      ({ width, height } = page.getSize());
      y = height - MARGIN;
    }
  };

  const line = (text: string, size: number, f: typeof font, color = ink, indent = 0) => {
    for (const l of wrap(text, size, f, width - MARGIN * 2 - indent)) {
      ensure(size + 4);
      page.drawText(l, { x: MARGIN + indent, y, size, font: f, color });
      y -= size + 4;
    }
  };

  // Header
  line(pdfSafe(ds.form.title), 20, bold, ink);
  y -= 2;
  line("Responses report", 11, font, accent);
  line(
    `${ds.total} response${ds.total === 1 ? "" : "s"}  ·  generated ${ds.generatedAt
      .toISOString()
      .slice(0, 16)
      .replace("T", " ")} UTC`,
    9,
    font,
    muted,
  );
  y -= 8;

  if (ds.total === 0) {
    line("No responses yet.", 11, font, muted);
  }

  // One block per response — robust for forms with many fields.
  ds.rows.forEach((row, i) => {
    y -= 6;
    ensure(24);
    page.drawRectangle({
      x: MARGIN,
      y: y - 2,
      width: width - MARGIN * 2,
      height: 1.5,
      color: accent,
    });
    y -= 10;
    line(`#${ds.total - i}  ·  ${String(row[0] ?? "")}`, 10, bold, ink);
    for (let c = 1; c < ds.columns.length; c++) {
      const val = row[c];
      if (val === null || val === "") continue;
      line(`${ds.columns[c]}: ${String(val)}`, 9, font, ink, 12);
    }
  });

  return doc.save();
}

async function exportHandler(req: Request, res: ExpressResponse) {
  const format = req.params.format as string;
  if (format !== "csv" && format !== "xlsx" && format !== "pdf") {
    return res.status(404).json({ error: "Not found" });
  }
  const fmt = format as Format;

  const headers = toWebHeaders(req.headers);
  const session = await auth.api.getSession({ headers }).catch(() => null);
  const user = session?.user ?? (await userFromApiKey(headers).catch(() => null));
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const formId = req.params.formId;
  if (!formId) return res.status(404).json({ error: "Not found" });
  const form = await db.query.forms.findFirst({
    where: eq(schema.forms.id, formId),
    columns: { id: true, userId: true, slug: true },
  });
  // Ownership probe returns 404 (not 403) — consistent with the tRPC guards.
  if (!form || form.userId !== user.id) {
    return res.status(404).json({ error: "Not found" });
  }

  const fromRaw = typeof req.query.from === "string" ? req.query.from : undefined;
  const toRaw = typeof req.query.to === "string" ? req.query.to : undefined;
  const filters: ExportFilters = {};
  if (fromRaw && !Number.isNaN(Date.parse(fromRaw))) filters.from = new Date(fromRaw);
  if (toRaw && !Number.isNaN(Date.parse(toRaw))) filters.to = new Date(toRaw);

  const ds = await buildExportDataset(formId, filters);
  const filename = `${form.slug}-responses.${fmt}`;

  res.setHeader("Content-Type", CONTENT_TYPE[fmt]);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");

  if (fmt === "csv") {
    return res.send(toCsv(ds));
  }
  const bytes = fmt === "xlsx" ? await toXlsx(ds) : await toPdf(ds);
  return res.send(Buffer.from(bytes));
}

// Express matches the literal ".:format" so a path like
// /forms/<id>/export.csv populates params.format = "csv".
app.get("/forms/:formId/export.:format", (req, res) => {
  exportHandler(req, res).catch((err) => {
    console.error("[export] unhandled error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal error" });
  });
});

/* -------------------------------------------------------------------------- */
/* 8. OpenAPI + Scalar docs                                                   */
/* -------------------------------------------------------------------------- */
// Prefer the auto-generated spec from trpc-to-openapi. It introspects the Zod
// input/output of openapi-tagged procedures; if that fails (e.g. Zod major
// mismatch with zod-openapi), fall back to a hand-written spec so Scalar still
// renders and the server always boots.
function buildOpenApiDocument(): Record<string, unknown> {
  try {
    return generateOpenApiDocument(serverRouter, {
      title: "Probe API",
      version: "1.0.0",
      baseUrl: env.PUBLIC_APP_URL + "/api",
    }) as unknown as Record<string, unknown>;
  } catch (err) {
    logger.warn(
      `trpc-to-openapi generation failed (${(err as Error).message}); serving hand-written spec.`,
    );
    return FALLBACK_OPENAPI;
  }
}

const FALLBACK_OPENAPI: Record<string, unknown> = {
  openapi: "3.0.3",
  info: {
    title: "Probe API",
    version: "1.0.0",
    description: "Open source form builder. Type-safe tRPC API. Self-hosted.",
  },
  servers: [{ url: env.PUBLIC_APP_URL }],
  paths: {
    "/health": {
      get: { summary: "Service health probe.", responses: { "200": { description: "OK" } } },
    },
    "/trpc/public.getForm": {
      get: {
        summary: "Fetch a published form by slug for the public renderer.",
        parameters: [
          {
            name: "input",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: 'JSON-encoded tRPC input, e.g. {"slug":"my-form-abc123"}',
          },
        ],
        responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
      },
    },
    "/trpc/public.listPublicForms": {
      get: { summary: "Paginated list of public + published forms (explore page)." },
    },
    "/trpc/public.submitResponse": {
      post: {
        summary: "Submit a response to a published form. Rate-limited per IP/form.",
        responses: { "200": { description: "OK" }, "429": { description: "Too many requests" } },
      },
    },
    "/submit": {
      post: {
        summary:
          "Endpoint-form submission. Public, cross-origin, layered abuse mitigations (honeypot, captcha, origin allowlist, rate limit).",
        responses: {
          "200": { description: "Submission received" },
          "303": { description: "Redirect when `redirect` provided + allowed" },
          "401": { description: "Invalid access key" },
          "403": { description: "Origin not allowed or recipient unverified" },
          "413": { description: "Payload too large" },
          "422": { description: "Spam rejected" },
          "429": { description: "Rate limited" },
        },
      },
    },
    "/api/auth/sign-in/email": { post: { summary: "Email/password sign-in (Better Auth)." } },
    "/api/auth/sign-up/email": { post: { summary: "Email/password registration (Better Auth)." } },
  },
};

const openApiDocument = buildOpenApiDocument();

app.get("/openapi.json", (_req, res) => {
  return res.json(openApiDocument);
});

// API reference (Scalar). Relocated from /docs → /api/docs so the /docs path can
// serve the Starlight documentation site. Registered before the /api OpenAPI
// middleware below so it matches first.
app.use("/api/docs", apiReference({ url: "/openapi.json" }));

/* -------------------------------------------------------------------------- */
/* 8b. Documentation site (Astro + Starlight) at /docs                        */
/* -------------------------------------------------------------------------- */
// Built to apps/docs/dist with base:"/docs". The web app reverse-proxies
// /docs → here, so the docs live at the same origin as the app.
const DOCS_DIST = [
  path.resolve(process.cwd(), "../docs/dist"), // api cwd = apps/api
  path.resolve(process.cwd(), "apps/docs/dist"), // cwd = repo root
  "/app/apps/docs/dist", // container layout
].find((p) => existsSync(path.join(p, "index.html")));

if (DOCS_DIST) {
  // Serve the docs home explicitly so we DON'T emit express.static's directory
  // trailing-slash 301 (`/docs` → `/docs/`). Behind the Next proxy — which drops
  // the trailing slash on rewrite — that 301 would ping-pong into a redirect loop.
  app.get("/docs", (_req, res) => res.sendFile(path.join(DOCS_DIST, "index.html")));
  // `redirect: false` keeps express.static from issuing any trailing-slash 301.
  app.use("/docs", express.static(DOCS_DIST, { redirect: false, extensions: ["html"] }));
  // Fallback for anything static missed: resolve a directory index (no trailing
  // slash), else serve Starlight's own 404 page (not the API 404).
  app.use("/docs", (req, res) => {
    const rel = req.path.replace(/^\/+/, "");
    const index = path.join(DOCS_DIST, rel, "index.html");
    if (rel && existsSync(index)) return res.sendFile(index);
    return res.status(404).sendFile(path.join(DOCS_DIST, "404.html"));
  });
  logger.debug(`docs site served from ${DOCS_DIST} at ${env.PUBLIC_APP_URL}/docs`);
} else {
  // Dev convenience: dist not built yet — show a hint instead of a hard 404.
  app.get(/^\/docs(?:\/.*)?$/, (_req, res) => {
    res
      .status(200)
      .type("html")
      .send(
        `<!doctype html><meta charset="utf-8"><title>Probe docs</title>` +
          `<body style="font-family:system-ui;max-width:42rem;margin:4rem auto;padding:0 1rem">` +
          `<h1>📚 Docs site not built</h1>` +
          `<p>Run <code>pnpm --filter @repo/docs build</code> to generate the documentation site, then reload.</p>` +
          `<p>The API reference is at <a href="/api/docs">/api/docs</a>.</p></body>`,
      );
  });
  logger.warn(
    "apps/docs/dist not found — /docs shows a build hint. (Run `pnpm --filter @repo/docs build`.) API reference is at /api/docs.",
  );
}

/* -------------------------------------------------------------------------- */
/* 9. tRPC-to-OpenAPI REST middleware at /api                                 */
/* -------------------------------------------------------------------------- */
try {
  app.use(
    "/api",
    createOpenApiExpressMiddleware({
      router: serverRouter,
      createContext,
    }),
  );
} catch (err) {
  logger.warn(
    `trpc-to-openapi REST middleware unavailable (${(err as Error).message}); /trpc remains the primary API.`,
  );
}

/* -------------------------------------------------------------------------- */
/* 10. tRPC at /trpc                                                          */
/* -------------------------------------------------------------------------- */
app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: serverRouter,
    createContext,
  }),
);

logger.debug(`openapi.json available at ${env.PUBLIC_APP_URL}/openapi.json`);
logger.debug(`API reference (Scalar) available at ${env.PUBLIC_APP_URL}/api/docs`);

export default app;
