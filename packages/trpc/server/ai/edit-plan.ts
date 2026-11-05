import type { schema } from "@repo/database";
import { aiFieldTypeSchema, type AiEditDraft } from "@repo/services/validators";

/**
 * Turns an AI edit (the whole revised form) into a reviewable plan against the
 * form's current fields. The plan never trusts the model's ids: an id that isn't
 * one of this form's fields, or is used twice, becomes a new field. Kept fields
 * keep their row, so their answers and anything else not shown to the model
 * (scoring, validation, conditional logic) survive the edit.
 */

type FieldRow = typeof schema.fields.$inferSelect;
type FieldType = FieldRow["type"];
type Option = { label: string; value: string; score?: number };

const OPTION_TYPES: FieldType[] = ["single_select", "multi_select", "ranking"];
const AI_TYPES = new Set<string>(aiFieldTypeSchema.options);

export interface PlannedField {
  id: string | null;
  type: FieldType;
  label: string;
  required: boolean;
  placeholder: string | null;
  helpText: string | null;
  options?: Option[];
  change: "added" | "changed" | "unchanged";
  /** What changed on a kept field, in words, e.g. ["label", "required"]. */
  details: string[];
}

export interface EditPlan {
  title: string;
  description: string | null;
  fields: PlannedField[];
  removed: { id: string; label: string; answers: number }[];
}

/** The per-type `config` jsonb for a field that has no previous config to keep. */
export function configForField(type: FieldType, options?: Option[]): Record<string, unknown> {
  switch (type) {
    case "single_select":
    case "multi_select":
    case "ranking":
      return { options: options ?? [] };
    case "rating":
      return { maxRating: 5, ratingStyle: "star" };
    case "linear_scale":
      return { scaleMin: 1, scaleMax: 5 };
    default:
      return {};
  }
}

/** Existing options, matched by label, keep their stored value (and score) so old answers still line up. */
function mergeOptions(previous: Option[], next: Option[]): Option[] {
  const byLabel = new Map(previous.map((o) => [o.label.trim().toLowerCase(), o]));
  return next.map((o) => {
    const prev = byLabel.get(o.label.trim().toLowerCase());
    return prev ? { ...prev, label: o.label } : { label: o.label, value: o.value };
  });
}

function sameOptions(a: Option[], b: Option[]): boolean {
  return a.length === b.length && a.every((o, i) => o.label === b[i]?.label && o.value === b[i]?.value);
}

export function buildPlan(
  existing: FieldRow[],
  answerCounts: Map<string, number>,
  draft: AiEditDraft,
): EditPlan {
  const byId = new Map(existing.map((f) => [f.id, f]));
  const kept = new Set<string>();

  const fields = draft.fields.map((f): PlannedField => {
    const prev = f.id && !kept.has(f.id) ? byId.get(f.id) : undefined;

    if (!prev) {
      // New fields only get the types the AI can configure reliably.
      const type: FieldType = AI_TYPES.has(f.type) ? f.type : "short_text";
      return {
        id: null,
        type,
        label: f.label,
        required: f.required,
        placeholder: f.placeholder ?? null,
        helpText: f.helpText ?? null,
        options: OPTION_TYPES.includes(type) ? (f.options ?? []) : undefined,
        change: "added",
        details: [],
      };
    }

    kept.add(prev.id);
    // Never switch a field to or from a type the AI can't configure.
    const type: FieldType = AI_TYPES.has(f.type) && AI_TYPES.has(prev.type) ? f.type : prev.type;
    const prevOptions = (prev.config?.options ?? []) as Option[];
    let options: Option[] | undefined;
    if (OPTION_TYPES.includes(type)) {
      options = f.options?.length ? mergeOptions(prevOptions, f.options) : prevOptions;
    }

    const details: string[] = [];
    if (type !== prev.type) details.push("type");
    if (f.label !== prev.label) details.push("question");
    if (f.required !== prev.required) details.push(f.required ? "now required" : "now optional");
    if ((f.placeholder ?? null) !== (prev.placeholder ?? null)) details.push("placeholder");
    if ((f.helpText ?? null) !== (prev.helpText ?? null)) details.push("help text");
    if (options && !sameOptions(options, prevOptions)) details.push("options");

    return {
      id: prev.id,
      type,
      label: f.label,
      required: f.required,
      placeholder: f.placeholder ?? null,
      helpText: f.helpText ?? null,
      options,
      change: details.length ? "changed" : "unchanged",
      details,
    };
  });

  const removed = existing
    .filter((f) => !kept.has(f.id))
    .map((f) => ({ id: f.id, label: f.label, answers: answerCounts.get(f.id) ?? 0 }));

  return { title: draft.title, description: draft.description ?? null, fields, removed };
}

/** The row values to write for a planned field at position `order`. */
export function fieldValues(planned: PlannedField, prev: FieldRow | undefined, removedIds: Set<string>, order: number) {
  let config: Record<string, unknown>;
  if (prev && prev.type === planned.type) {
    config = { ...(prev.config ?? {}), ...(planned.options ? { options: planned.options } : {}) };
  } else {
    config = configForField(planned.type, planned.options);
  }

  // Drop show-if rules that point at removed questions.
  let conditionalLogic = prev?.conditionalLogic ?? null;
  if (conditionalLogic) {
    const showIf = conditionalLogic.showIf.filter((r) => !removedIds.has(r.fieldId));
    conditionalLogic = showIf.length ? { showIf } : null;
  }

  return {
    type: planned.type,
    label: planned.label,
    required: planned.required,
    placeholder: planned.placeholder,
    helpText: planned.helpText,
    order,
    config,
    conditionalLogic,
  };
}
