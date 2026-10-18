import { z } from "zod";

import type { ConditionalLogicInput, FieldConfigInput, FieldTypeInput } from "./field";

/**
 * Minimal field shape needed to build a respondent-input validator.
 * We accept this instead of the full DB row so the function works on both
 * server (full row) and client (sanitized public form data).
 */
export interface FieldDefinition {
  id: string;
  type: FieldTypeInput;
  label: string;
  required: boolean;
  placeholder?: string | null;
  helpText?: string | null;
  config?: FieldConfigInput;
  conditionalLogic?: ConditionalLogicInput | null;
}

const isFilled = (val: unknown): boolean => {
  if (val === undefined || val === null) return false;
  if (typeof val === "string") return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  // Composite values (e.g. address) count as filled only if a part is filled.
  if (typeof val === "object") return Object.values(val).some((v) => isFilled(v));
  return true;
};

/** A page_break is a layout marker, not an answerable field. */
export const isPageBreak = (field: { type: FieldTypeInput }): boolean =>
  field.type === "page_break";

/** A hidden field is prefilled from the URL and never shown to the respondent. */
export const isHidden = (field: FieldDefinition): boolean =>
  Boolean(field.config?.hidden);

/**
 * Evaluate a field's conditional logic against the full draft answers.
 * Returns true if the field should be shown (and therefore validated).
 * AND logic across rules — every rule must pass.
 */
export function shouldShowField(
  field: FieldDefinition,
  answers: Record<string, unknown>,
): boolean {
  const logic = field.conditionalLogic;
  if (!logic || logic.showIf.length === 0) return true;

  return logic.showIf.every((rule) => {
    const other = answers[rule.fieldId];
    switch (rule.operator) {
      case "is_filled":
        return isFilled(other);
      case "is_empty":
        return !isFilled(other);
      case "equals":
        return other === rule.value;
      case "not_equals":
        return other !== rule.value;
      case "contains":
        if (typeof other === "string" && typeof rule.value === "string") {
          return other.toLowerCase().includes(rule.value.toLowerCase());
        }
        if (Array.isArray(other)) {
          return other.includes(rule.value as never);
        }
        return false;
      default:
        return true;
    }
  });
}

function baseSchemaForField(field: FieldDefinition): z.ZodTypeAny {
  const cfg = field.config ?? {};

  switch (field.type) {
    case "short_text": {
      let s = z.string().trim();
      if (cfg.minLength !== undefined) s = s.min(cfg.minLength);
      if (cfg.maxLength !== undefined) s = s.max(cfg.maxLength);
      return s;
    }
    case "long_text": {
      let s = z.string();
      if (cfg.minLength !== undefined) s = s.min(cfg.minLength);
      if (cfg.maxLength !== undefined) s = s.max(cfg.maxLength);
      return s;
    }
    case "email":
      return z.string().trim().toLowerCase().email("Enter a valid email");
    case "url":
      return z.string().trim().url("Enter a valid URL");
    case "phone":
      return z
        .string()
        .trim()
        .min(5, "Phone number is too short")
        .max(40, "Phone number is too long");
    case "number": {
      let n = z.coerce.number();
      if (cfg.min !== undefined) n = n.min(cfg.min);
      if (cfg.max !== undefined) n = n.max(cfg.max);
      return n;
    }
    case "rating": {
      const max = cfg.maxRating ?? 5;
      return z.coerce.number().int().min(1).max(max);
    }
    case "checkbox":
      return z.coerce.boolean();
    case "date":
      return z.string().min(1);
    case "single_select": {
      const opts = cfg.options ?? [];
      if (opts.length === 0) return z.string();
      const values = opts.map((o) => o.value) as [string, ...string[]];
      return z.enum(values);
    }
    case "multi_select": {
      const opts = cfg.options ?? [];
      if (opts.length === 0) return z.array(z.string());
      const values = opts.map((o) => o.value) as [string, ...string[]];
      return z.array(z.enum(values)).min(0);
    }
    case "linear_scale": {
      const min = cfg.scaleMin ?? 1;
      const max = cfg.scaleMax ?? 5;
      return z.coerce.number().int().min(min).max(max);
    }
    case "ranking": {
      const opts = cfg.options ?? [];
      if (opts.length === 0) return z.array(z.string());
      const values = opts.map((o) => o.value) as [string, ...string[]];
      // A ranking is the full set of option values in the respondent's order.
      return z.array(z.enum(values));
    }
    case "address":
      return z
        .object({
          line1: z.string().max(200).optional(),
          line2: z.string().max(200).optional(),
          city: z.string().max(120).optional(),
          state: z.string().max(120).optional(),
          postal: z.string().max(40).optional(),
          country: z.string().max(120).optional(),
        })
        .partial();
    case "time":
      return z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time");
    case "signature":
      // A data-URL PNG produced by the signature pad.
      return z.string().regex(/^data:image\/png;base64,/, "Signature required");
    case "file_upload":
      // Metadata for a file already uploaded to R2 via a presigned PUT. The
      // key's namespacing is re-verified server-side in submitResponse.
      return z.object({
        key: z.string().min(1),
        name: z.string().min(1).max(300),
        size: z.number().int().min(0),
        type: z.string().max(200),
      });
    case "page_break":
      return z.unknown();
    default:
      return z.unknown();
  }
}

/**
 * Build a Zod schema from a form's actual field definitions.
 * Runs on both the server (submitResponse) and the client (inline validation).
 *
 * Required + conditional logic are evaluated at parse time using superRefine
 * so a field hidden by its conditional rules is allowed to be empty even if
 * marked required.
 */
export function buildResponseSchema(fields: FieldDefinition[]) {
  const answerable = fields.filter((f) => !isPageBreak(f));
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of answerable) {
    shape[f.id] = baseSchemaForField(f).nullish();
  }

  return z.object(shape).superRefine((data, ctx) => {
    const answers = data as Record<string, unknown>;
    for (const f of answerable) {
      if (!shouldShowField(f, answers)) continue;
      const val = answers[f.id];

      // Hidden (URL-prefilled) fields are never required — the respondent
      // can't fill them, so a missing prefill must not block submission.
      if (f.required && !isHidden(f) && !isFilled(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [f.id],
          message: `${f.label} is required`,
        });
        continue;
      }

      // Re-validate non-empty values with the base schema (without optional wrapper)
      if (isFilled(val)) {
        const base = baseSchemaForField(f);
        const result = base.safeParse(val);
        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({ ...issue, path: [f.id, ...issue.path] });
          }
        }
      }
    }
  });
}

/**
 * Answer piping: replace `{{<fieldId>}}` tokens in a label/description with the
 * respondent's earlier answer. Used in field labels, help text, and outcomes.
 */
export function pipeText(text: string, answers: Record<string, unknown>): string {
  if (!text || !text.includes("{{")) return text;
  return text.replace(/\{\{\s*([0-9a-fA-F-]{36})\s*\}\}/g, (_m, id: string) => {
    const v = answers[id];
    if (v === undefined || v === null) return "";
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "object") return Object.values(v).filter(Boolean).join(", ");
    return String(v);
  });
}

/**
 * Quiz scoring: sum option scores (single/multi select) and numeric answers
 * (rating, linear_scale, number). The single source of truth for the score so
 * the client preview and the server-stored score never disagree.
 */
export function computeScore(
  fields: FieldDefinition[],
  answers: Record<string, unknown>,
): number {
  let total = 0;
  for (const f of fields) {
    const v = answers[f.id];
    if (v === undefined || v === null) continue;
    const opts = f.config?.options ?? [];
    if (f.type === "single_select") {
      total += opts.find((o) => o.value === v)?.score ?? 0;
    } else if (f.type === "multi_select" && Array.isArray(v)) {
      for (const val of v) total += opts.find((o) => o.value === val)?.score ?? 0;
    } else if (
      (f.type === "rating" || f.type === "linear_scale" || f.type === "number") &&
      typeof v === "number"
    ) {
      total += v;
    }
  }
  return total;
}

export function pickScoreOutcome<T extends { min: number; max: number }>(
  outcomes: T[],
  score: number,
): T | null {
  return outcomes.find((o) => score >= o.min && score <= o.max) ?? null;
}

// ---- API payload schemas --------------------------------------------------

export const submitResponseSchema = z.object({
  slug: z.string(),
  values: z.record(z.string(), z.unknown()),
  submitterEmail: z.string().email().optional(),
  submitterName: z.string().max(120).optional(),
  password: z.string().max(120).optional(),
  completionTime: z.number().int().min(0).optional(),
  referrer: z.string().max(500).optional(),
});
export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;

export const trackEventSchema = z.object({
  slug: z.string(),
  event: z.enum(["view", "start", "abandon"]),
  fieldId: z.string().uuid().optional(),
});
export type TrackEventInput = z.infer<typeof trackEventSchema>;

export const listResponsesSchema = z.object({
  formId: z.string().uuid(),
  cursor: z.string().uuid().nullish(),
  limit: z.number().int().min(1).max(100).default(25),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type ListResponsesInput = z.infer<typeof listResponsesSchema>;

export const exportResponsesSchema = z.object({
  formId: z.string().uuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
