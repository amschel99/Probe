/**
 * Email service — Resend wrapper + template builders.
 * Exposes a typed sender plus the canonical message templates.
 */

import { Resend } from "resend";

import { env } from "../env";

let resend: Resend | null = null;

function getClient(): Resend | null {
  const key = env.RESEND_API_KEY;
  if (!key) return null;
  if (!resend) resend = new Resend(key);
  return resend;
}

/** True when RESEND_API_KEY is set; otherwise sendEmail() is a no-op. */
export function isEmailConfigured(): boolean {
  return !!env.RESEND_API_KEY;
}

/** The bare address from RESEND_FROM ("Probe <noreply@x.com>" → "noreply@x.com"). */
export function senderAddress(): string {
  const match = env.RESEND_FROM.match(/<([^>]+)>/);
  return (match?.[1] ?? env.RESEND_FROM).trim();
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const client = getClient();
  if (!client) {
    console.warn("[email] RESEND_API_KEY not set — skipping send:", input.subject);
    return;
  }
  const from = input.from ?? env.RESEND_FROM;
  // Resend reports API failures (unverified domain, bad sender…) in `error`
  // rather than throwing — surface them so they reach the logs.
  const { error } = await client.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
  if (error) {
    console.error(`[email] Resend rejected "${input.subject}" (from ${from}):`, error);
    throw new Error(`Email send failed: ${error.message}`);
  }
}

export const TEMPLATES = {
  welcome: (name: string) => ({
    subject: "Welcome to Probe",
    html: `
      <h1>Welcome, ${name}.</h1>
      <p>You built nothing yet. That's fine. Here's how to start:</p>
      <ol>
        <li>Pick a theme.</li>
        <li>Add some fields.</li>
        <li>Share the link.</li>
      </ol>
      <p>— Probe</p>
    `,
  }),
  formNotification: (opts: { formTitle: string; viewUrl: string }) => ({
    subject: "Someone filled your form and had opinions",
    html: `
      <p>You got a new response on <strong>${opts.formTitle}</strong>.</p>
      <p><a href="${opts.viewUrl}">View all responses →</a></p>
    `,
  }),
  responseConfirmation: (opts: { formTitle: string; successMessage: string }) => ({
    subject: `Got it. Thanks for filling out "${opts.formTitle}"`,
    html: `
      <p>${opts.successMessage}</p>
      <p>— Probe</p>
    `,
  }),
} as const;
