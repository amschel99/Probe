import { db, eq, schema } from "@repo/database";
import { decryptSecret, encryptSecret, makeAutoSlug } from "@repo/services";
import {
  aiProviderSchema,
  generateFormSchema,
  setAiConfigSchema,
  type AiGeneratedField,
} from "@repo/services/validators";
import { TRPCError } from "@trpc/server";

import { generateDraft, PROVIDERS, verifyConfig, type AiConfig } from "../../ai/providers";
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

/** Build the per-type `config` jsonb for a generated field. */
function configForField(field: AiGeneratedField): Record<string, unknown> {
  switch (field.type) {
    case "single_select":
    case "multi_select":
    case "ranking":
      return { options: field.options ?? [] };
    case "rating":
      return { maxRating: 5, ratingStyle: "star" };
    case "linear_scale":
      return { scaleMin: 1, scaleMax: 5 };
    default:
      return {};
  }
}

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
            config: configForField(field),
          })),
        );
        return created;
      });

      return { id: form.id, slug: form.slug, fieldCount: draft.fields.length };
    }),
});
