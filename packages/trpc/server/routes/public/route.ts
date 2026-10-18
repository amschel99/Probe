import { and, desc, eq, ilike, schema, sql } from "@repo/database";
import { logger } from "@repo/logger";
import { sendEmail, TEMPLATES } from "@repo/services/email";
import {
  deliverResponseToIntegrations,
  eventLimiter,
  getClientIp,
  hashIp,
  submitLimiter,
} from "@repo/services";
import {
  buildResponseSchema,
  listPublicFormsSchema,
  submitResponseSchema,
  trackEventSchema,
  type FieldDefinition,
} from "@repo/services/validators";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";

import { env } from "../../env";
import { z } from "../../schema";
import { publicProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import { isKeyForForm } from "../uploads/route";

const TAGS = ["Forms"];
const getPath = generatePath("/forms");

function sanitizeForm(form: typeof schema.forms.$inferSelect) {
  const { settings, ...rest } = form;
  return {
    ...rest,
    // Don't leak the password hash to the client
    settings: { ...settings, passwordHash: settings.passwordHash ? "***" : null },
  };
}

export const publicRouter = router({
  getForm: publicProcedure
    .meta({ openapi: { method: "GET", path: getPath("/{slug}"), tags: TAGS } })
    .input(z.object({ slug: z.string(), password: z.string().optional() }))
    .output(z.any())
    .query(async ({ ctx, input }) => {
      const form = await ctx.db.query.forms.findFirst({
        where: eq(schema.forms.slug, input.slug),
        with: { fields: { orderBy: (f, { asc }) => [asc(f.order)] }, theme: true },
      });
      if (!form) throw new TRPCError({ code: "NOT_FOUND" });
      if (form.type !== "hosted") throw new TRPCError({ code: "NOT_FOUND" });
      if (form.status !== "published") throw new TRPCError({ code: "NOT_FOUND" });

      if (form.expiresAt && form.expiresAt < new Date()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Form has closed" });
      }
      if (form.maxResponses && form.responseCount >= form.maxResponses) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Form is full" });
      }

      if (form.settings.passwordHash) {
        if (!input.password) {
          return { passwordRequired: true as const, form: null, fields: [], theme: null };
        }
        const ok = await bcrypt.compare(input.password, form.settings.passwordHash);
        if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "Wrong password" });
      }

      return {
        passwordRequired: false as const,
        form: sanitizeForm(form),
        fields: form.fields,
        theme: form.theme,
      };
    }),

  submitResponse: publicProcedure
    .meta({ openapi: { method: "POST", path: getPath("/{slug}/responses"), tags: TAGS } })
    .input(submitResponseSchema)
    .output(z.any())
    .mutation(async ({ ctx, input }) => {
      const form = await ctx.db.query.forms.findFirst({
        where: eq(schema.forms.slug, input.slug),
        with: { fields: { orderBy: (f, { asc }) => [asc(f.order)] } },
      });
      if (!form) throw new TRPCError({ code: "NOT_FOUND" });
      if (form.type !== "hosted" || form.status !== "published") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (form.expiresAt && form.expiresAt < new Date()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Form has closed" });
      }
      if (form.maxResponses && form.responseCount >= form.maxResponses) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Form is full" });
      }
      if (form.settings.passwordHash) {
        if (!input.password) throw new TRPCError({ code: "FORBIDDEN", message: "Password required" });
        const ok = await bcrypt.compare(input.password, form.settings.passwordHash);
        if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "Wrong password" });
      }

      // Rate limit by IP + form
      const ip = getClientIp(ctx.req);
      const { success } = await submitLimiter.limit(`submit:${form.id}:${ip}`);
      if (!success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many submissions — slow down",
        });
      }

      // Validate values against the form's actual fields
      const fieldDefs: FieldDefinition[] = form.fields.map((f) => ({
        id: f.id,
        type: f.type,
        label: f.label,
        required: f.required,
        config: f.config ?? {},
        conditionalLogic: f.conditionalLogic ?? null,
      }));
      const parsed = buildResponseSchema(fieldDefs).safeParse(input.values);
      if (!parsed.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Validation failed",
          cause: parsed.error,
        });
      }

      // Never trust a client-provided file key: every file_upload answer must
      // reference an object under this form's upload prefix (set at presign).
      for (const f of form.fields) {
        if (f.type !== "file_upload") continue;
        const val = parsed.data[f.id];
        if (val && typeof val === "object" && "key" in val) {
          const key = (val as { key: unknown }).key;
          if (typeof key !== "string" || !isKeyForForm(key, form.id)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid file reference" });
          }
        }
      }

      // Persist response + values + bump counters in one transaction
      const ipHash = hashIp(ip);
      const userAgent = ctx.req.header("user-agent") ?? null;

      const responseId = await ctx.db.transaction(async (tx) => {
        const [response] = await tx
          .insert(schema.responses)
          .values({
            formId: form.id,
            submissionType: "hosted",
            submitterEmail: input.submitterEmail,
            submitterName: input.submitterName,
            ipHash,
            userAgent: userAgent?.slice(0, 500),
            referrer: input.referrer?.slice(0, 500),
            completionTime: input.completionTime ?? null,
          })
          .returning();
        if (!response) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const valuesToInsert = Object.entries(parsed.data)
          .filter(([, v]) => v !== undefined && v !== null && !(typeof v === "string" && v === ""))
          .map(([fieldId, value]) => ({
            responseId: response.id,
            fieldId,
            value: value as never,
          }));
        if (valuesToInsert.length > 0) {
          await tx.insert(schema.responseValues).values(valuesToInsert);
        }

        await tx
          .update(schema.forms)
          .set({
            responseCount: sql`${schema.forms.responseCount} + 1`,
          })
          .where(eq(schema.forms.id, form.id));

        await tx.insert(schema.analyticsEvents).values({
          formId: form.id,
          event: "submit",
        });

        return response.id;
      });

      // Deliver to per-form integrations (Discord / Sheets) — NON-BLOCKING.
      // Never let an integration failure affect the 200 response.
      void deliverResponseToIntegrations({
        db: ctx.db,
        formId: form.id,
        formTitle: form.title,
        fields: form.fields.map((f) => ({ id: f.id, label: f.label })),
        values: parsed.data as Record<string, unknown>,
      }).catch((err) =>
        logger.error(`[public.submitResponse] integration delivery failed: ${err}`),
      );

      // Fire emails async
      if (form.settings.notifyCreator) {
        const creator = await ctx.db.query.users.findFirst({
          where: eq(schema.users.id, form.userId),
          columns: { email: true },
        });
        if (creator) {
          const tpl = TEMPLATES.formNotification({
            formTitle: form.title,
            viewUrl: `${env.PUBLIC_APP_URL}/dashboard/forms/${form.id}/responses`,
          });
          sendEmail({ to: creator.email, subject: tpl.subject, html: tpl.html }).catch(
            console.error,
          );
        }
      }
      if (form.settings.sendConfirmationEmail && input.submitterEmail) {
        const tpl = TEMPLATES.responseConfirmation({
          formTitle: form.title,
          successMessage: form.settings.successMessage,
        });
        sendEmail({ to: input.submitterEmail, subject: tpl.subject, html: tpl.html }).catch(
          console.error,
        );
      }

      return {
        ok: true,
        responseId,
        successMessage: form.settings.successMessage,
        redirectUrl: form.settings.redirectUrl,
      };
    }),

  trackEvent: publicProcedure.input(trackEventSchema).mutation(async ({ ctx, input }) => {
    const ip = getClientIp(ctx.req);
    const { success } = await eventLimiter.limit(`event:${ip}`);
    if (!success) return { ok: false as const };

    const form = await ctx.db.query.forms.findFirst({
      where: eq(schema.forms.slug, input.slug),
      columns: { id: true, status: true, type: true },
    });
    if (!form || form.type !== "hosted" || form.status !== "published") {
      return { ok: false as const };
    }

    await ctx.db.insert(schema.analyticsEvents).values({
      formId: form.id,
      event: input.event,
      metadata: input.fieldId ? { fieldId: input.fieldId } : null,
    });
    if (input.event === "view") {
      await ctx.db
        .update(schema.forms)
        .set({ viewCount: sql`${schema.forms.viewCount} + 1` })
        .where(eq(schema.forms.id, form.id));
    }
    return { ok: true as const };
  }),

  listPublicForms: publicProcedure
    .meta({ openapi: { method: "GET", path: getPath("/"), tags: TAGS } })
    .input(listPublicFormsSchema)
    .output(z.any())
    .query(async ({ ctx, input }) => {
      const where = and(
        eq(schema.forms.status, "published"),
        eq(schema.forms.visibility, "public"),
        eq(schema.forms.type, "hosted"),
        input.search ? ilike(schema.forms.title, `%${input.search}%`) : undefined,
      );

      const rows = await ctx.db
        .select({
          id: schema.forms.id,
          slug: schema.forms.slug,
          title: schema.forms.title,
          description: schema.forms.description,
          responseCount: schema.forms.responseCount,
          publishedAt: schema.forms.publishedAt,
          theme: {
            slug: schema.themes.slug,
            name: schema.themes.name,
            config: schema.themes.config,
          },
        })
        .from(schema.forms)
        .leftJoin(schema.themes, eq(schema.forms.themeId, schema.themes.id))
        .where(where)
        .orderBy(desc(schema.forms.publishedAt))
        .limit(input.limit);

      return { items: rows };
    }),
});
