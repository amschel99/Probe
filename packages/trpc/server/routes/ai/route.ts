import { and, asc, db, eq, inArray, schema, sql } from "@repo/database";
import { decryptSecret, encryptSecret, makeAutoSlug } from "@repo/services";
import {
  aiProviderSchema,
  applyFormEditSchema,
  generateFormSchema,
  proposeFormEditSchema,
  setAiConfigSchema,
  type AiEditDraft,
} from "@repo/services/validators";
import { TRPCError } from "@trpc/server";

import { buildPlan, configForField, fieldValues } from "../../ai/edit-plan";
import { generateDraft, generateEditDraft, PROVIDERS, verifyConfig, type AiConfig } from "../../ai/providers";
import { env } from "../../env";
import { protectedProcedure, router } from "../../trpc";

const HOSTED_DEFAULT_SETTINGS = {
  allowMultipleSubmissions: true,
  requireEmail: false,
  sendConfirmationEmail: false,
  notifyCreator: true,
  successMessage: "Got it. Thanks for filling this out.",
  redirectUrl: null,
  passwordHash: null,
} as const;

/** The instance-wide AI config from env, if the deployer set one. */
function instanceConfig(): AiConfig | null {
  const provider = aiProviderSchema.safeParse(env.AI_PROVIDER);
  if (!provider.success) return null;
  const info = PROVIDERS[provider.data];
  const model = env.AI_MODEL || info.defaultModel;
  if (!model) return null;
  if (provider.data === "custom" ? !env.AI_BASE_URL : !env.AI_API_KEY) return null;
  return {
    provider: provider.data,
    apiKey: env.AI_API_KEY ?? null,
    model,
    baseUrl: env.AI_BASE_URL ?? null,
  };
}

/** The user's own AI config (their saved key), if any. */
async function userConfig(database: typeof db, userId: string): Promise<AiConfig | null> {
  const row = await database.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { aiApiKeyEnc: true, aiProvider: true, aiModel: true, aiBaseUrl: true },
  });
  if (!row) return null;
  // Rows saved before multi-provider support have a key and no provider: Anthropic.
  const provider = aiProviderSchema.safeParse(row.aiProvider ?? (row.aiApiKeyEnc ? "anthropic" : null));
  if (!provider.success) return null;
  if (provider.data !== "custom" && !row.aiApiKeyEnc) return null;
  return {
    provider: provider.data,
    apiKey: row.aiApiKeyEnc ? decryptSecret(row.aiApiKeyEnc) : null,
    model: row.aiModel || PROVIDERS[provider.data].defaultModel,
    baseUrl: row.aiBaseUrl,
  };
}

/** Which config a generation would use: the user's own key wins over the instance's. */
async function resolveConfig(database: typeof db, userId: string) {
  const own = await userConfig(database, userId);
  if (own) return { cfg: own, source: "user" as const };
  const inst = instanceConfig();
  if (inst) return { cfg: inst, source: "instance" as const };
  return null;
}

/** The form, if this user owns it. */
async function ownedForm(database: typeof db, formId: string, userId: string) {
  const form = await database.query.forms.findFirst({
    where: and(eq(schema.forms.id, formId), eq(schema.forms.userId, userId)),
    columns: { title: true, description: true, status: true, slug: true },
  });
  if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "Form not found." });
  return form;
}

/** A form's fields in order, plus how many answers each one holds. */
async function loadFields(database: typeof db, formId: string) {
  const fields = await database
    .select()
    .from(schema.fields)
    .where(eq(schema.fields.formId, formId))
    .orderBy(asc(schema.fields.order));
  const counts = new Map<string, number>();
  if (fields.length) {
    const rows = await database
      .select({ fieldId: schema.responseValues.fieldId, n: sql<number>`count(*)::int` })
      .from(schema.responseValues)
      .where(inArray(schema.responseValues.fieldId, fields.map((f) => f.id)))
      .groupBy(schema.responseValues.fieldId);
    for (const r of rows) counts.set(r.fieldId, r.n);
  }
  return { fields, counts };
}

async function plan(database: typeof db, formId: string, draft: AiEditDraft) {
  const { fields, counts } = await loadFields(database, formId);
  return { fields, plan: buildPlan(fields, counts, draft) };
}

export const aiRouter = router({
  /** Whether AI generation is available to this user, and through what. */
  status: protectedProcedure.query(async ({ ctx }) => {
    const resolved = await resolveConfig(ctx.db, ctx.user.id);
    return {
      hasKey: !!resolved,
      source: resolved?.source ?? null,
      provider: resolved?.cfg.provider ?? null,
      providerLabel: resolved ? PROVIDERS[resolved.cfg.provider].label : null,
      model: resolved?.cfg.model ?? null,
      baseUrl: resolved?.source === "user" ? resolved.cfg.baseUrl : null,
      providers: Object.values(PROVIDERS).map((p) => ({
        id: p.id,
        label: p.label,
        defaultModel: p.defaultModel,
        keyUrl: p.keyUrl ?? null,
      })),
    };
  }),

  /** Verify the key against the provider, then store it (encrypted) with provider + model. */
  setKey: protectedProcedure.input(setAiConfigSchema).mutation(async ({ ctx, input }) => {
    if (input.provider === "custom") {
      // A custom base URL makes the server call an arbitrary address — admins only.
      const row = await ctx.db.query.users.findFirst({
        where: eq(schema.users.id, ctx.user.id),
        columns: { role: true },
      });
      if (row?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can use a custom AI endpoint." });
      }
    }
    const cfg: AiConfig = {
      provider: input.provider,
      apiKey: input.apiKey || null,
      model: input.model || PROVIDERS[input.provider].defaultModel,
      baseUrl: input.provider === "custom" ? input.baseUrl ?? null : null,
    };
    await verifyConfig(cfg);
    await ctx.db
      .update(schema.users)
      .set({
        aiApiKeyEnc: cfg.apiKey ? encryptSecret(cfg.apiKey) : null,
        aiProvider: cfg.provider,
        aiModel: input.model || null,
        aiBaseUrl: cfg.baseUrl,
      })
      .where(eq(schema.users.id, ctx.user.id));
    return { ok: true };
  }),

  /** Forget the user's own AI settings (the instance default, if any, takes over). */
  clearKey: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(schema.users)
      .set({ aiApiKeyEnc: null, aiProvider: null, aiModel: null, aiBaseUrl: null })
      .where(eq(schema.users.id, ctx.user.id));
    return { ok: true };
  }),

  /** Generate a form (title + fields) from a prompt and persist it for the user. */
  generateForm: protectedProcedure
    .input(generateFormSchema)
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveConfig(ctx.db, ctx.user.id);
      if (!resolved) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Connect an AI provider in Settings to generate forms.",
        });
      }
      const draft = await generateDraft(resolved.cfg, input.prompt);

      // Persist: form + fields in one transaction, owned by the user.
      const form = await ctx.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(schema.forms)
          .values({
            slug: makeAutoSlug(draft.title),
            userId: ctx.user.id,
            themeId: input.themeId,
            type: "hosted",
            title: draft.title,
            description: draft.description ?? null,
            visibility: "unlisted",
            settings: HOSTED_DEFAULT_SETTINGS,
          })
          .returning();
        if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await tx.insert(schema.fields).values(
          draft.fields.map((field, i) => ({
            formId: created.id,
            type: field.type,
            label: field.label,
            placeholder: field.placeholder ?? null,
            helpText: field.helpText ?? null,
            required: field.required,
            order: i,
            config: configForField(field.type, field.options),
          })),
        );
        return created;
      });

      return { id: form.id, slug: form.slug, fieldCount: draft.fields.length };
    }),

  /**
   * Ask the AI to change an existing form. Nothing is saved: the result is a plan
   * the owner reviews (what's added, changed and removed, and how many answers a
   * removal would delete) before calling applyEdit.
   */
  proposeEdit: protectedProcedure.input(proposeFormEditSchema).mutation(async ({ ctx, input }) => {
    const form = await ownedForm(ctx.db, input.formId, ctx.user.id);
    const resolved = await resolveConfig(ctx.db, ctx.user.id);
    if (!resolved) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Connect an AI provider in Settings to edit forms with AI.",
      });
    }
    const { fields } = await loadFields(ctx.db, input.formId);
    const draft = await generateEditDraft(
      resolved.cfg,
      {
        title: form.title,
        description: form.description ?? null,
        fields: fields.map((f) => ({
          id: f.id,
          type: f.type,
          label: f.label,
          required: f.required,
          placeholder: f.placeholder ?? null,
          helpText: f.helpText ?? null,
          options: (f.config?.options ?? []).map((o) => ({ label: o.label, value: o.value })),
        })),
      },
      input.instruction,
    );
    return (await plan(ctx.db, input.formId, draft)).plan;
  }),

  /**
   * Apply a reviewed plan. Kept fields are updated in place, so their answers stay;
   * removed fields go with their answers. The slug never changes, so the form's
   * link stays the same, and `publish` puts the edited form live at that link.
   */
  applyEdit: protectedProcedure.input(applyFormEditSchema).mutation(async ({ ctx, input }) => {
    const form = await ownedForm(ctx.db, input.formId, ctx.user.id);
    const { fields: existing, plan: p } = await plan(ctx.db, input.formId, input.draft);
    const byId = new Map(existing.map((f) => [f.id, f]));
    const removedIds = new Set(p.removed.map((r) => r.id));

    await ctx.db.transaction(async (tx) => {
      if (removedIds.size) {
        await tx.delete(schema.fields).where(inArray(schema.fields.id, [...removedIds]));
      }
      for (const [i, f] of p.fields.entries()) {
        const values = fieldValues(f, f.id ? byId.get(f.id) : undefined, removedIds, i);
        if (f.id) {
          await tx.update(schema.fields).set(values).where(eq(schema.fields.id, f.id));
        } else {
          await tx.insert(schema.fields).values({ formId: input.formId, ...values });
        }
      }
      await tx
        .update(schema.forms)
        .set({
          title: p.title,
          description: p.description,
          updatedAt: new Date(),
          ...(input.publish && form.status !== "published"
            ? { status: "published" as const, publishedAt: new Date() }
            : {}),
        })
        .where(eq(schema.forms.id, input.formId));
    });

    return {
      slug: form.slug,
      published: input.publish || form.status === "published",
      added: p.fields.filter((f) => f.change === "added").length,
      changed: p.fields.filter((f) => f.change === "changed").length,
      removed: p.removed.length,
    };
  }),
});
