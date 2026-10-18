import Anthropic from "@anthropic-ai/sdk";
import { db, eq, schema } from "@repo/database";
import { decryptSecret, encryptSecret, makeAutoSlug } from "@repo/services";
import {
  aiFieldTypeSchema,
  aiGeneratedFormSchema,
  generateFormSchema,
  setAiKeySchema,
  type AiGeneratedField,
} from "@repo/services/validators";
import { TRPCError } from "@trpc/server";

import { protectedProcedure, router } from "../../trpc";

// Users bring their own key, so the model is the deployer's choice, not a cost
// we bear. Opus 4.7 gives the best field choices; effort stays low because form
// drafting is a short, scoped task and we want it fast/cheap for the user.
const AI_MODEL = "claude-opus-4-7";

const SYSTEM_PROMPT = `You are a form-building assistant for Probe. Given a short description, design a clean, sensible web form by calling the create_form tool exactly once.

Guidelines:
- Pick the most fitting field type for each question. Use single_select/multi_select (with options) over free text when the answer is from a known set.
- Provide options ONLY for single_select and multi_select fields.
- Mark a field required only when the form genuinely needs it.
- Keep it focused: 3–10 fields for most forms. Order fields logically.
- Write a short, human title and an optional one-line description.
- Use email type for email addresses, phone for phone numbers, url for links, rating for satisfaction (1–5 stars), linear_scale for agreement/likelihood scales.`;

const HOSTED_DEFAULT_SETTINGS = {
  allowMultipleSubmissions: true,
  requireEmail: false,
  sendConfirmationEmail: false,
  notifyCreator: true,
  successMessage: "Got it. Thanks for filling this out.",
  redirectUrl: null,
  passwordHash: null,
} as const;

// Hand-written JSON Schema for the tool — mirrors aiGeneratedFormSchema. We
// validate the model's output against the Zod schema regardless, so this only
// needs to steer the model toward the right shape.
const CREATE_FORM_TOOL: Anthropic.Tool = {
  name: "create_form",
  description: "Create a web form definition from the user's description.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short, human form title" },
      description: { type: "string", description: "Optional one-line description" },
      fields: {
        type: "array",
        description: "The form's fields, in display order",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: [...aiFieldTypeSchema.options] },
            label: { type: "string", description: "The question / field label" },
            required: { type: "boolean" },
            placeholder: { type: "string" },
            helpText: { type: "string" },
            options: {
              type: "array",
              description: "Choices — ONLY for single_select and multi_select",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  value: { type: "string" },
                },
                required: ["label", "value"],
              },
            },
          },
          required: ["type", "label", "required"],
        },
      },
    },
    required: ["title", "fields"],
  },
};

/** Build the per-type `config` jsonb for a generated field. */
function configForField(field: AiGeneratedField): Record<string, unknown> {
  switch (field.type) {
    case "single_select":
    case "multi_select":
      return { options: field.options ?? [] };
    case "rating":
      return { maxRating: 5, ratingStyle: "star" };
    case "linear_scale":
      return { scaleMin: 1, scaleMax: 5 };
    default:
      return {};
  }
}

/** Map an Anthropic SDK error onto a tRPC error with a user-facing message. */
function mapAnthropicError(err: unknown): TRPCError {
  if (err instanceof Anthropic.AuthenticationError) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: "Your Anthropic API key was rejected. Check it in Settings.",
    });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Anthropic rate-limited the request. Try again in a moment.",
    });
  }
  if (err instanceof Anthropic.APIError) {
    return new TRPCError({
      code: "BAD_GATEWAY",
      message: `Anthropic API error (${err.status ?? "?"}). Try again.`,
    });
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Form generation failed." });
}

async function getUserApiKey(database: typeof db, userId: string) {
  const row = await database.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { aiApiKeyEnc: true },
  });
  if (!row?.aiApiKeyEnc) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Add your Anthropic API key in Settings to use AI generation.",
    });
  }
  return decryptSecret(row.aiApiKeyEnc);
}

export const aiRouter = router({
  /** Whether the signed-in user has an Anthropic key saved (feature gate for the UI). */
  status: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.query.users.findFirst({
      where: eq(schema.users.id, ctx.user.id),
      columns: { aiApiKeyEnc: true },
    });
    return { hasKey: !!row?.aiApiKeyEnc, model: AI_MODEL };
  }),

  /** Validate the key with a live auth probe, then store it encrypted. */
  setKey: protectedProcedure.input(setAiKeySchema).mutation(async ({ ctx, input }) => {
    const client = new Anthropic({ apiKey: input.apiKey });
    try {
      // Cheap, free auth check — 401s on a bad key without spending tokens.
      await client.models.list({ limit: 1 });
    } catch (err) {
      throw mapAnthropicError(err);
    }
    await ctx.db
      .update(schema.users)
      .set({ aiApiKeyEnc: encryptSecret(input.apiKey) })
      .where(eq(schema.users.id, ctx.user.id));
    return { ok: true };
  }),

  /** Forget the stored key. */
  clearKey: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(schema.users)
      .set({ aiApiKeyEnc: null })
      .where(eq(schema.users.id, ctx.user.id));
    return { ok: true };
  }),

  /** Generate a form (title + fields) from a prompt and persist it for the user. */
  generateForm: protectedProcedure
    .input(generateFormSchema)
    .mutation(async ({ ctx, input }) => {
      const apiKey = await getUserApiKey(ctx.db, ctx.user.id);
      const client = new Anthropic({ apiKey });

      let message: Anthropic.Message;
      try {
        message = await client.messages.create({
          model: AI_MODEL,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          tools: [CREATE_FORM_TOOL],
          tool_choice: { type: "tool", name: "create_form" },
          messages: [{ role: "user", content: input.prompt }],
        });
      } catch (err) {
        throw mapAnthropicError(err);
      }

      const toolUse = message.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      if (!toolUse) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The model didn't return a form. Try rephrasing your prompt.",
        });
      }

      const parsed = aiGeneratedFormSchema.safeParse(toolUse.input);
      if (!parsed.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The generated form was malformed. Try again.",
        });
      }
      const draft = parsed.data;

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
