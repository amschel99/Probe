import { z } from "zod";

/**
 * Validators for AI form generation. Users bring their own provider API key;
 * the model returns a form draft which we validate against these schemas before
 * persisting. The field-type subset excludes layout/markers and types that need
 * bespoke config the model can't reliably produce (signature, page_break, etc.).
 */

export const aiFieldTypeSchema = z.enum([
  "short_text",
  "long_text",
  "email",
  "number",
  "single_select",
  "multi_select",
  "checkbox",
  "rating",
  "date",
  "phone",
  "url",
  "linear_scale",
  "ranking",
  "time",
]);
export type AiFieldType = z.infer<typeof aiFieldTypeSchema>;

export const aiGeneratedOptionSchema = z.object({
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(120),
});

export const aiGeneratedFieldSchema = z.object({
  type: aiFieldTypeSchema,
  label: z.string().trim().min(1).max(200),
  required: z.boolean().default(false),
  placeholder: z.string().max(200).nullish(),
  helpText: z.string().max(500).nullish(),
  // Only meaningful for single_select / multi_select.
  options: z.array(aiGeneratedOptionSchema).max(50).optional(),
});
export type AiGeneratedField = z.infer<typeof aiGeneratedFieldSchema>;

export const aiGeneratedFormSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  fields: z.array(aiGeneratedFieldSchema).min(1).max(25),
});
export type AiGeneratedForm = z.infer<typeof aiGeneratedFormSchema>;

/**
 * Providers a user can bring a key for. Everything except `anthropic` speaks the
 * OpenAI-compatible chat-completions API. `custom` takes a base URL (e.g. a local
 * Ollama at http://localhost:11434/v1) and is restricted to admins.
 */
export const aiProviderSchema = z.enum([
  "anthropic",
  "openai",
  "deepseek",
  "gemini",
  "openrouter",
  "groq",
  "mistral",
  "custom",
]);
export type AiProvider = z.infer<typeof aiProviderSchema>;

/** Save the user's AI settings. The key is verified live before it's stored. */
export const setAiConfigSchema = z
  .object({
    provider: aiProviderSchema,
    apiKey: z.string().trim().max(400).optional(),
    model: z.string().trim().max(120).optional(),
    baseUrl: z.string().trim().url("Enter a full URL like http://localhost:11434/v1").max(300).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.provider !== "custom" && (!v.apiKey || v.apiKey.length < 8)) {
      ctx.addIssue({ code: "custom", path: ["apiKey"], message: "Paste your API key" });
    }
    if (v.provider === "custom" && !v.baseUrl) {
      ctx.addIssue({ code: "custom", path: ["baseUrl"], message: "A base URL is required" });
    }
    if (v.provider === "custom" && !v.model) {
      ctx.addIssue({ code: "custom", path: ["model"], message: "Name the model to use" });
    }
  });
export type SetAiConfigInput = z.infer<typeof setAiConfigSchema>;

export const generateFormSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(3, "Describe the form you want")
    .max(2000, "Keep the description under 2000 characters"),
  themeId: z.string().uuid(),
});
export type GenerateFormInput = z.infer<typeof generateFormSchema>;
