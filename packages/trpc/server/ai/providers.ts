import Anthropic from "@anthropic-ai/sdk";
import {
  aiFieldTypeSchema,
  aiGeneratedFormSchema,
  type AiGeneratedForm,
  type AiProvider,
} from "@repo/services/validators";
import { TRPCError } from "@trpc/server";

/**
 * AI providers for form drafting. Anthropic goes through its SDK; every other
 * provider speaks the OpenAI-compatible chat-completions API, so one client
 * covers OpenAI, DeepSeek, Gemini, OpenRouter, Groq, Mistral and any custom
 * endpoint (e.g. a local Ollama).
 */
export interface ProviderInfo {
  id: AiProvider;
  label: string;
  defaultModel: string;
  /** OpenAI-compatible base URL (unused for anthropic; user-supplied for custom). */
  baseUrl?: string;
  keyUrl?: string;
}

export const PROVIDERS: Record<AiProvider, ProviderInfo> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    defaultModel: "claude-opus-5-5",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4.1-mini",
    baseUrl: "https://api.openai.com/v1",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    defaultModel: "deepseek-chat",
    baseUrl: "https://api.deepseek.com/v1",
    keyUrl: "https://platform.deepseek.com/api_keys",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "openrouter/auto",
    baseUrl: "https://openrouter.ai/api/v1",
    keyUrl: "https://openrouter.ai/keys",
  },
  groq: {
    id: "groq",
    label: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    baseUrl: "https://api.groq.com/openai/v1",
    keyUrl: "https://console.groq.com/keys",
  },
  mistral: {
    id: "mistral",
    label: "Mistral",
    defaultModel: "mistral-small-latest",
    baseUrl: "https://api.mistral.ai/v1",
    keyUrl: "https://console.mistral.ai/api-keys",
  },
  custom: {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    defaultModel: "",
  },
};

export interface AiConfig {
  provider: AiProvider;
  apiKey: string | null;
  model: string;
  baseUrl: string | null;
}

const SYSTEM_PROMPT = `You design web forms for Probe, a form builder. Given a short description, return one clean, sensible form.

Guidelines:
- Pick the most fitting field type for each question. Prefer single_select / multi_select (with options) over free text when the answer comes from a known set.
- Give options only for single_select, multi_select and ranking; use an empty array for every other type.
- Mark a field required only when the form genuinely needs it.
- Keep it focused: 3-10 fields for most forms, in a logical order.
- Write a short, human title and an optional one-line description ("" if none).
- Use email for email addresses, phone for phone numbers, url for links, rating for 1-5 satisfaction, linear_scale for agreement or likelihood, date and time for when.
- placeholder and helpText may be "" when not useful.
- Write the form in the same language as the description.`;

/** The draft shape, as JSON Schema. Every property required so it also works as a strict schema. */
const FORM_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    fields: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: [...aiFieldTypeSchema.options] },
          label: { type: "string" },
          required: { type: "boolean" },
          placeholder: { type: "string" },
          helpText: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { label: { type: "string" }, value: { type: "string" } },
              required: ["label", "value"],
            },
          },
        },
        required: ["type", "label", "required", "placeholder", "helpText", "options"],
      },
    },
  },
  required: ["title", "description", "fields"],
} as const;

const TIMEOUT_MS = 90_000;

/** Validate + tidy a raw model draft: blanks become absent, options only where they belong. */
function normalizeDraft(raw: unknown): AiGeneratedForm {
  const parsed = aiGeneratedFormSchema.safeParse(raw);
  if (!parsed.success) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The generated form was malformed. Try again or rephrase.",
    });
  }
  const d = parsed.data;
  return {
    title: d.title,
    description: d.description?.trim() || undefined,
    fields: d.fields.map((f) => ({
      ...f,
      placeholder: f.placeholder?.trim() || undefined,
      helpText: f.helpText?.trim() || undefined,
      options: ["single_select", "multi_select", "ranking"].includes(f.type) ? f.options : undefined,
    })),
  };
}

/** Pull a JSON object out of model text (tolerates ```json fences and chatter). */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The model didn't return a form. Try rephrasing your description.",
    });
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The model returned invalid JSON. Try again.",
    });
  }
}

/* ── Anthropic ─────────────────────────────────────────────────────────── */

/** Effort is accepted on the 4.6+ / 5.x families; older models reject it. */
function supportsEffort(model: string): boolean {
  return /^claude-(fable|mythos|opus-5|sonnet-5|haiku-5|opus-4-[678])/.test(model);
}

function mapAnthropicError(err: unknown): TRPCError {
  if (err instanceof TRPCError) return err;
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new TRPCError({ code: "BAD_REQUEST", message: "Your Anthropic API key was rejected." });
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new TRPCError({ code: "BAD_REQUEST", message: "That Claude model wasn't found. Check the model name." });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Anthropic rate-limited the request. Try again shortly." });
  }
  if (err instanceof Anthropic.APIError) {
    return new TRPCError({ code: "BAD_GATEWAY", message: `Anthropic API error (${err.status ?? "?"}). Try again.` });
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Form generation failed." });
}

async function generateWithAnthropic(cfg: AiConfig, prompt: string): Promise<AiGeneratedForm> {
  const client = new Anthropic({ apiKey: cfg.apiKey ?? undefined, timeout: TIMEOUT_MS });
  try {
    const response = await client.beta.messages.create({
      model: cfg.model,
      max_tokens: 16000,
      // Server-side fallback: if the model declines, the API re-runs the
      // request on its default fallback model inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      output_config: {
        ...(supportsEffort(cfg.model) ? { effort: "low" as const } : {}),
        format: { type: "json_schema", schema: FORM_JSON_SCHEMA },
      },
    });
    if (response.stop_reason === "refusal") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "The model declined this request. Try rephrasing it." });
    }
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    return normalizeDraft(extractJson(text));
  } catch (err) {
    throw mapAnthropicError(err);
  }
}

async function verifyAnthropic(cfg: AiConfig) {
  const client = new Anthropic({ apiKey: cfg.apiKey ?? undefined, timeout: 20_000 });
  try {
    // Free auth check — 401s on a bad key without spending tokens.
    await client.models.list({ limit: 1 });
  } catch (err) {
    throw mapAnthropicError(err);
  }
}

/* ── OpenAI-compatible ─────────────────────────────────────────────────── */

function baseUrlFor(cfg: AiConfig): string {
  const base = cfg.provider === "custom" ? cfg.baseUrl : PROVIDERS[cfg.provider].baseUrl;
  if (!base) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No base URL configured." });
  return base.replace(/\/+$/, "");
}

function headersFor(cfg: AiConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
    // OpenRouter uses these to label traffic; harmless elsewhere.
    "X-Title": "Probe",
  };
}

async function providerError(res: Response, label: string): Promise<TRPCError> {
  let detail = "";
  try {
    const body = (await res.json()) as { error?: { message?: string } | string; message?: string };
    detail = typeof body.error === "string" ? body.error : body.error?.message ?? body.message ?? "";
  } catch {
    // non-JSON error body
  }
  const suffix = detail ? `: ${detail.slice(0, 180)}` : "";
  if (res.status === 401 || res.status === 403) {
    return new TRPCError({ code: "BAD_REQUEST", message: `${label} rejected the API key${suffix}` });
  }
  if (res.status === 404) {
    return new TRPCError({ code: "BAD_REQUEST", message: `${label} couldn't find that model${suffix}` });
  }
  if (res.status === 429) {
    return new TRPCError({ code: "TOO_MANY_REQUESTS", message: `${label} rate-limited the request${suffix}` });
  }
  return new TRPCError({ code: "BAD_GATEWAY", message: `${label} error (${res.status})${suffix}` });
}

async function generateWithOpenAiCompatible(cfg: AiConfig, prompt: string): Promise<AiGeneratedForm> {
  const label = PROVIDERS[cfg.provider].label;
  const url = `${baseUrlFor(cfg)}/chat/completions`;
  const messages = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\nReply with a single JSON object only, matching this JSON Schema:\n${JSON.stringify(FORM_JSON_SCHEMA)}`,
    },
    { role: "user", content: prompt },
  ];

  const call = (jsonMode: boolean) =>
    fetch(url, {
      method: "POST",
      headers: headersFor(cfg),
      body: JSON.stringify({
        model: cfg.model,
        messages,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  let res: Response;
  try {
    res = await call(true);
    // Some endpoints/models don't support JSON mode — retry once without it.
    if (res.status === 400) res = await call(false);
  } catch {
    throw new TRPCError({ code: "BAD_GATEWAY", message: `Couldn't reach ${label}. Check the URL and try again.` });
  }
  if (!res.ok) throw await providerError(res, label);

  const body = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  const content = body.choices?.[0]?.message?.content ?? "";
  return normalizeDraft(extractJson(content));
}

async function verifyOpenAiCompatible(cfg: AiConfig) {
  const label = PROVIDERS[cfg.provider].label;
  let res: Response;
  try {
    res = await fetch(`${baseUrlFor(cfg)}/models`, {
      headers: headersFor(cfg),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Couldn't reach ${label}. Check the URL.` });
  }
  // Only a definite auth failure blocks saving; some endpoints don't list models.
  if (res.status === 401 || res.status === 403) throw await providerError(res, label);
}

/* ── Public API ────────────────────────────────────────────────────────── */

export function generateDraft(cfg: AiConfig, prompt: string): Promise<AiGeneratedForm> {
  return cfg.provider === "anthropic"
    ? generateWithAnthropic(cfg, prompt)
    : generateWithOpenAiCompatible(cfg, prompt);
}

export function verifyConfig(cfg: AiConfig): Promise<void> {
  return cfg.provider === "anthropic" ? verifyAnthropic(cfg) : verifyOpenAiCompatible(cfg);
}
