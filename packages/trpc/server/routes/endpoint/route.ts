import { and, desc, eq, ilike, schema } from "@repo/database";
import { DEFAULT_ENDPOINT_SETTINGS } from "@repo/database/schema";
import { isEmailConfigured, sendEmail } from "@repo/services/email";
import {
  assertFormOwner,
  encryptSecret,
  makeAutoSlug,
  normalizeOrigin,
} from "@repo/services";
import {
  createEndpointFormSchema,
  endpointIdSchema,
  listEndpointFormsSchema,
  rotateKeySchema,
  updateEndpointFormSchema,
  verifyAccessKeySchema,
} from "@repo/services/validators";
import { TRPCError } from "@trpc/server";
import { customAlphabet } from "nanoid";
import { randomBytes } from "node:crypto";

import { env } from "../../env";
import { protectedProcedure, publicProcedure, router } from "../../trpc";

const accessKey = customAlphabet(
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789",
  36,
);

function newVerificationToken(): string {
  return randomBytes(24).toString("base64url");
}

async function sendVerificationEmail(opts: {
  to: string;
  formTitle: string;
  token: string;
}) {
  const verifyUrl = `${env.PUBLIC_APP_URL}/api/verify-access-key/${opts.token}`;
  // Without email configured nobody could ever verify the key, so surface the
  // link in the server logs — the instance owner can open it directly.
  if (!isEmailConfigured()) {
    console.warn(`[endpoint] email not configured — verify "${opts.formTitle}" at: ${verifyUrl}`);
    return;
  }
  return sendEmail({
    to: opts.to,
    subject: `Verify Probe endpoint: ${opts.formTitle}`,
    html: `
      <p>You're about to start receiving submissions from <strong>${opts.formTitle}</strong>.</p>
      <p>Confirm this email address by clicking below — link is valid for 24 hours.</p>
      <p><a href="${verifyUrl}" style="background:#B8722E;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Verify endpoint</a></p>
      <p style="color:#888;font-size:12px">If you didn't request this, ignore the email — the form won't deliver submissions until someone clicks the link.</p>
    `,
  });
}

export const endpointRouter = router({
  list: protectedProcedure.input(listEndpointFormsSchema).query(async ({ ctx, input }) => {
    const where = and(
      eq(schema.forms.userId, ctx.user.id),
      eq(schema.forms.type, "endpoint"),
      input.search ? ilike(schema.forms.title, `%${input.search}%`) : undefined,
    );
    const rows = await ctx.db
      .select({
        id: schema.forms.id,
        title: schema.forms.title,
        websiteUrl: schema.forms.websiteUrl,
        recipientEmail: schema.forms.recipientEmail,
        accessKey: schema.forms.accessKey,
        accessKeyVerifiedAt: schema.forms.accessKeyVerifiedAt,
        responseCount: schema.forms.responseCount,
        lastSubmittedAt: schema.forms.lastSubmittedAt,
        createdAt: schema.forms.createdAt,
      })
      .from(schema.forms)
      .where(where)
      .orderBy(desc(schema.forms.updatedAt))
      .limit(input.limit);
    return { items: rows };
  }),

  get: protectedProcedure.input(endpointIdSchema).query(async ({ ctx, input }) => {
    const form = await ctx.db.query.forms.findFirst({
      where: and(eq(schema.forms.id, input.id), eq(schema.forms.userId, ctx.user.id)),
    });
    if (!form || form.type !== "endpoint") throw new TRPCError({ code: "NOT_FOUND" });
    // Strip captcha secret ciphertext from client view (the existence-flag is enough)
    const settings = form.endpointSettings;
    return {
      ...form,
      endpointSettings: settings
        ? { ...settings, captchaSecret: settings.captchaSecret ? "***" : null }
        : null,
    };
  }),

  create: protectedProcedure.input(createEndpointFormSchema).mutation(async ({ ctx, input }) => {
    // Need at least one theme to satisfy themeId NOT NULL — pick any built-in.
    const fallbackTheme = await ctx.db.query.themes.findFirst({
      columns: { id: true },
    });
    if (!fallbackTheme) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No themes available; run db:seed first.",
      });
    }

    const recipient = input.recipientEmail ?? ctx.user.email;
    const websiteOrigin = normalizeOrigin(input.websiteUrl);
    const key = accessKey();

    const form = await ctx.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(schema.forms)
        .values({
          slug: makeAutoSlug(input.title + " endpoint"),
          userId: ctx.user.id,
          themeId: fallbackTheme.id,
          type: "endpoint",
          title: input.title,
          status: "published",
          visibility: "unlisted",
          settings: {
            allowMultipleSubmissions: true,
            requireEmail: false,
            sendConfirmationEmail: false,
            notifyCreator: true,
            successMessage: "Submission received.",
            redirectUrl: null,
            passwordHash: null,
          },
          accessKey: key,
          recipientEmail: recipient,
          websiteUrl: input.websiteUrl,
          allowedOrigins: [websiteOrigin],
          endpointSettings: DEFAULT_ENDPOINT_SETTINGS,
          publishedAt: new Date(),
        })
        .returning();
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const token = newVerificationToken();
      await tx.insert(schema.accessKeyVerifications).values({
        formId: created.id,
        token,
        recipientEmail: recipient,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      await tx.insert(schema.endpointAudit).values({
        formId: created.id,
        actorId: ctx.user.id,
        action: "verification_sent",
        detail: { recipient },
      });

      // Send verification email async — don't block the response
      sendVerificationEmail({
        to: recipient,
        formTitle: created.title,
        token,
      }).catch(console.error);

      return created;
    });

    return {
      ...form,
      accessKey: form.accessKey,
    };
  }),

  update: protectedProcedure.input(updateEndpointFormSchema).mutation(async ({ ctx, input }) => {
    await assertFormOwner(ctx.db, input.id, ctx.user.id);
    const current = await ctx.db.query.forms.findFirst({
      where: eq(schema.forms.id, input.id),
    });
    if (!current || current.type !== "endpoint") throw new TRPCError({ code: "NOT_FOUND" });

    const patch: Partial<typeof schema.forms.$inferInsert> = {};
    let recipientChanged = false;

    if (input.title !== undefined) patch.title = input.title;
    if (input.allowedOrigins !== undefined) {
      patch.allowedOrigins = input.allowedOrigins.map(normalizeOrigin);
    }
    if (input.recipientEmail !== undefined && input.recipientEmail !== current.recipientEmail) {
      recipientChanged = true;
      // Don't update recipientEmail until the new one verifies.
      // Keep old one active in the meantime; queue a verification for the new.
    }

    if (input.endpointSettings) {
      const existing = current.endpointSettings ?? DEFAULT_ENDPOINT_SETTINGS;
      const merged = { ...existing };
      const s = input.endpointSettings;
      if (s.honeypotEnabled !== undefined) merged.honeypotEnabled = s.honeypotEnabled;
      if (s.captchaProvider !== undefined) merged.captchaProvider = s.captchaProvider;
      if (s.captchaSiteKey !== undefined) merged.captchaSiteKey = s.captchaSiteKey;
      if (s.captchaSecret !== undefined) {
        merged.captchaSecret = s.captchaSecret ? encryptSecret(s.captchaSecret) : null;
      }
      if (s.subjectTemplate !== undefined) merged.subjectTemplate = s.subjectTemplate;
      if (s.notifyEmails !== undefined) merged.notifyEmails = s.notifyEmails;
      if (s.redirectUrl !== undefined) merged.redirectUrl = s.redirectUrl;
      if (s.webhookUrl !== undefined) {
        merged.webhookUrl = s.webhookUrl;
        // Auto-generate a signing secret on first webhook URL set
        if (s.webhookUrl && !merged.webhookSigningSecret) {
          merged.webhookSigningSecret = randomBytes(32).toString("hex");
        }
      }
      if (s.allowServerSide !== undefined) merged.allowServerSide = s.allowServerSide;
      patch.endpointSettings = merged;
    }

    await ctx.db.update(schema.forms).set(patch).where(eq(schema.forms.id, input.id));

    if (recipientChanged && input.recipientEmail) {
      const token = newVerificationToken();
      await ctx.db.insert(schema.accessKeyVerifications).values({
        formId: input.id,
        token,
        recipientEmail: input.recipientEmail,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      await ctx.db.insert(schema.endpointAudit).values({
        formId: input.id,
        actorId: ctx.user.id,
        action: "recipient_changed",
        detail: { from: current.recipientEmail, to: input.recipientEmail },
      });
      sendVerificationEmail({
        to: input.recipientEmail,
        formTitle: current.title,
        token,
      }).catch(console.error);
    }

    return { ok: true, recipientPendingVerification: recipientChanged };
  }),

  rotateKey: protectedProcedure.input(rotateKeySchema).mutation(async ({ ctx, input }) => {
    await assertFormOwner(ctx.db, input.id, ctx.user.id);
    const key = accessKey();
    await ctx.db
      .update(schema.forms)
      .set({ accessKey: key })
      .where(eq(schema.forms.id, input.id));
    await ctx.db.insert(schema.endpointAudit).values({
      formId: input.id,
      actorId: ctx.user.id,
      action: "key_rotated",
      detail: {},
    });
    return { accessKey: key };
  }),

  resendVerification: protectedProcedure
    .input(endpointIdSchema)
    .mutation(async ({ ctx, input }) => {
      await assertFormOwner(ctx.db, input.id, ctx.user.id);
      const form = await ctx.db.query.forms.findFirst({
        where: eq(schema.forms.id, input.id),
      });
      if (!form || form.type !== "endpoint" || !form.recipientEmail) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const token = newVerificationToken();
      await ctx.db.insert(schema.accessKeyVerifications).values({
        formId: input.id,
        token,
        recipientEmail: form.recipientEmail,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      sendVerificationEmail({
        to: form.recipientEmail,
        formTitle: form.title,
        token,
      }).catch(console.error);
      return { ok: true };
    }),

  delete: protectedProcedure.input(endpointIdSchema).mutation(async ({ ctx, input }) => {
    await assertFormOwner(ctx.db, input.id, ctx.user.id);
    await ctx.db.delete(schema.forms).where(eq(schema.forms.id, input.id));
    return { ok: true };
  }),

  auditLog: protectedProcedure.input(endpointIdSchema).query(async ({ ctx, input }) => {
    await assertFormOwner(ctx.db, input.id, ctx.user.id);
    return ctx.db
      .select()
      .from(schema.endpointAudit)
      .where(eq(schema.endpointAudit.formId, input.id))
      .orderBy(desc(schema.endpointAudit.createdAt))
      .limit(50);
  }),

  // Public — token comes from email link
  verifyByToken: publicProcedure.input(verifyAccessKeySchema).mutation(async ({ ctx, input }) => {
    const ver = await ctx.db.query.accessKeyVerifications.findFirst({
      where: eq(schema.accessKeyVerifications.token, input.token),
    });
    if (!ver) throw new TRPCError({ code: "NOT_FOUND" });
    if (ver.usedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Already used" });
    if (ver.expiresAt < new Date()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Verification link expired" });
    }

    await ctx.db.transaction(async (tx) => {
      await tx
        .update(schema.accessKeyVerifications)
        .set({ usedAt: new Date() })
        .where(eq(schema.accessKeyVerifications.id, ver.id));
      await tx
        .update(schema.forms)
        .set({
          accessKeyVerifiedAt: new Date(),
          recipientEmail: ver.recipientEmail,
        })
        .where(eq(schema.forms.id, ver.formId));
      await tx.insert(schema.endpointAudit).values({
        formId: ver.formId,
        actorId: null,
        action: "verified",
        detail: { recipient: ver.recipientEmail },
      });
    });
    return { ok: true };
  }),
});
