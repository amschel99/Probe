"use client";

import {
  buildResponseSchema,
  computeScore,
  isHidden,
  isPageBreak,
  pickScoreOutcome,
  pipeText,
  shouldShowField,
  type FieldDefinition,
} from "@repo/services/validators";
import { useEffect, useMemo, useRef, useState } from "react";

import { trpc } from "@/lib/trpc";
import { applyThemeVars } from "@/lib/utils";

interface FileUploadValue {
  key: string;
  name: string;
  size: number;
  type: string;
}

type ThemeConfig = Parameters<typeof applyThemeVars>[0] & {
  logoEmoji?: string;
  surfaceAlt?: string;
};

interface ScoreOutcome {
  min: number;
  max: number;
  title: string;
  message: string;
}

export interface FormRendererProps {
  title: string;
  description?: string | null;
  fields: FieldDefinition[];
  theme: ThemeConfig;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  isPreview?: boolean;
  successMessage?: string;
  // Wave 2
  slug?: string;
  redirectUrl?: string | null;
  layout?: "classic" | "one_per_page";
  showProgressBar?: boolean;
  scoring?: { enabled: boolean; outcomes: ScoreOutcome[] } | null;
}

interface Page {
  title: string | null;
  intro: string | null;
  fields: FieldDefinition[];
}

/** Split fields into pages at page_break markers (or one-per-page if asked). */
function buildPages(fields: FieldDefinition[], layout?: string): Page[] {
  const answerable = fields.filter((f) => !isHidden(f));
  if (layout === "one_per_page") {
    return answerable
      .filter((f) => !isPageBreak(f))
      .map((f) => ({ title: null, intro: null, fields: [f] }));
  }
  const pages: Page[] = [{ title: null, intro: null, fields: [] }];
  for (const f of answerable) {
    if (isPageBreak(f)) {
      pages.push({ title: f.label, intro: f.helpText ?? null, fields: [] });
    } else {
      pages[pages.length - 1].fields.push(f);
    }
  }
  return pages.filter((p) => p.fields.length > 0 || p.title);
}

export function FormRenderer(props: FormRendererProps) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [outcome, setOutcome] = useState<ScoreOutcome | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const firstInteractionAt = useRef<number | null>(null);
  const formTopRef = useRef<HTMLDivElement | null>(null);

  const draftKey = props.slug && !props.isPreview ? `probe:draft:${props.slug}` : null;

  // Restore a saved draft + apply URL prefill once, after mount (avoids SSR
  // hydration mismatch — the server render is always the empty form).
  useEffect(() => {
    const init: Record<string, unknown> = {};
    if (draftKey) {
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) Object.assign(init, JSON.parse(raw));
      } catch {
        /* ignore corrupt draft */
      }
    }
    const params = new URLSearchParams(window.location.search);
    for (const f of props.fields) {
      const key = f.config?.prefillKey || f.id;
      if (params.has(key)) init[f.id] = params.get(key);
    }
    if (Object.keys(init).length) setValues(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave the draft as the respondent fills it in.
  useEffect(() => {
    if (!draftKey) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(values));
    } catch {
      /* storage full / disabled — non-fatal */
    }
  }, [values, draftKey]);

  function markInteraction() {
    if (firstInteractionAt.current === null) firstInteractionAt.current = Date.now();
  }

  function setValue(id: string, v: unknown) {
    markInteraction();
    setValues((prev) => ({ ...prev, [id]: v }));
    if (errors[id]) setErrors((e) => ({ ...e, [id]: "" }));
  }

  // Answerable fields (excludes page breaks + hidden), visible by conditional logic.
  const answerableFields = useMemo(
    () => props.fields.filter((f) => !isPageBreak(f) && !isHidden(f)),
    [props.fields],
  );

  const pages = useMemo(
    () => buildPages(props.fields, props.layout),
    [props.fields, props.layout],
  );
  const isMultiPage = pages.length > 1;
  const safePageIndex = Math.min(pageIndex, pages.length - 1);
  const currentPage = pages[safePageIndex];
  const isLastPage = safePageIndex >= pages.length - 1;

  const currentVisibleFields = useMemo(
    () => (currentPage?.fields ?? []).filter((f) => shouldShowField(f, values)),
    [currentPage, values],
  );

  function validateFields(fields: FieldDefinition[]): boolean {
    const schema = buildResponseSchema(fields);
    const result = schema.safeParse(values);
    if (result.success) return true;
    const next: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string | undefined;
      if (key && !next[key]) next[key] = issue.message;
    }
    setErrors((e) => ({ ...e, ...next }));
    return false;
  }

  function goTo(index: number) {
    setPageIndex(index);
    setErrors({});
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleNext() {
    if (props.isPreview) {
      goTo(safePageIndex + 1);
      return;
    }
    if (validateFields(currentVisibleFields)) goTo(safePageIndex + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (props.isPreview) return;
    // Validate every visible, answerable field across all pages.
    const allVisible = answerableFields.filter((f) => shouldShowField(f, values));
    if (!validateFields(allVisible)) return;

    setSubmitting(true);
    try {
      await props.onSubmit(values);
      if (draftKey) {
        try {
          localStorage.removeItem(draftKey);
        } catch {
          /* ignore */
        }
      }
      // Redirect takes precedence over the success screen.
      if (props.redirectUrl) {
        window.location.assign(props.redirectUrl);
        return;
      }
      if (props.scoring?.enabled) {
        const score = computeScore(answerableFields, values);
        setOutcome(pickScoreOutcome(props.scoring.outcomes, score));
      }
      setDone(true);
    } catch (err) {
      console.error(err);
      setErrors((prev) => ({ ...prev, __form: "Something went wrong. Please try again." }));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div
        data-probe-form
        data-preview={props.isPreview ? "" : undefined}
        style={applyThemeVars(props.theme)}
        className={props.isPreview ? "max-w-xl mx-auto p-10 text-center" : "w-full max-w-[680px] mx-auto py-16 text-center"}
      >
        <div
          className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full text-2xl"
          style={{ background: "var(--form-accent)", color: "var(--form-accent-text)" }}
          aria-hidden="true"
        >
          {outcome ? "🎉" : "✓"}
        </div>
        <h2 className="display text-3xl font-bold mb-2">{outcome?.title ?? "Submission received"}</h2>
        <p style={{ color: "var(--form-text-muted)" }}>
          {outcome?.message ?? props.successMessage ?? "Thanks for filling this out."}
        </p>
      </div>
    );
  }

  const progress = pages.length > 0 ? ((safePageIndex + 1) / pages.length) * 100 : 0;
  const showProgress = isMultiPage && props.showProgressBar !== false;

  return (
    <form
      data-probe-form
      data-preview={props.isPreview ? "" : undefined}
      style={applyThemeVars(props.theme)}
      onSubmit={handleSubmit}
      className={props.isPreview ? "max-w-xl mx-auto p-8 space-y-6" : "w-full max-w-[680px] mx-auto space-y-8"}
    >
      <div ref={formTopRef} />

      {showProgress && (
        <div>
          <div className="flex justify-between text-xs mb-1" style={{ color: "var(--form-text-muted)" }}>
            <span>
              Step {safePageIndex + 1} of {pages.length}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--form-border)" }}
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${progress}%`, background: "var(--form-accent)" }}
            />
          </div>
        </div>
      )}

      {/* Title + description only on the first page. */}
      {safePageIndex === 0 && (
        <div>
          <h1 className="display text-3xl sm:text-4xl font-bold leading-tight">{props.title}</h1>
          {props.description && (
            <p className="mt-3 text-base sm:text-lg whitespace-pre-line" style={{ color: "var(--form-text-muted)" }}>
              {pipeText(props.description, values)}
            </p>
          )}
        </div>
      )}

      {/* Page heading (from the page_break marker). */}
      {currentPage?.title && (
        <div>
          <h3 className="display text-xl font-bold">{pipeText(currentPage.title, values)}</h3>
          {currentPage.intro && (
            <p className="mt-1 text-sm" style={{ color: "var(--form-text-muted)" }}>
              {pipeText(currentPage.intro, values)}
            </p>
          )}
        </div>
      )}

      {currentVisibleFields.map((field) => {
        const grouped =
          field.type === "single_select" ||
          field.type === "multi_select" ||
          field.type === "rating" ||
          field.type === "linear_scale" ||
          field.type === "ranking";
        const errorId = errors[field.id] ? `${field.id}-error` : undefined;
        const helpId = field.helpText ? `${field.id}-help` : undefined;
        const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
        const Wrapper = grouped ? "fieldset" : "div";
        const Caption = grouped ? "legend" : "label";

        return (
          <Wrapper key={field.id} className="probe-field">
            <Caption className="label" style={{ color: "var(--form-text)" }} {...(grouped ? {} : { htmlFor: field.id })}>
              {pipeText(field.label, values)}
              {field.required && (
                <span aria-hidden="true" style={{ color: "var(--form-accent)" }}>
                  {" *"}
                </span>
              )}
            </Caption>
            {field.helpText && (
              <p id={helpId} className="probe-help" style={{ color: "var(--form-text-muted)" }}>
                {pipeText(field.helpText, values)}
              </p>
            )}
            <FieldInput
              field={field}
              id={field.id}
              value={values[field.id]}
              onChange={(v) => setValue(field.id, v)}
              invalid={Boolean(errors[field.id])}
              describedBy={describedBy}
              slug={props.slug}
              isPreview={props.isPreview}
            />
            {errors[field.id] && (
              <p id={errorId} role="alert" className="error">
                {errors[field.id]}
              </p>
            )}
          </Wrapper>
        );
      })}

      {errors.__form && (
        <p role="alert" className="error">
          {errors.__form}
        </p>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        {isMultiPage && safePageIndex > 0 && (
          <button type="button" className="probe-btn-secondary" onClick={() => goTo(safePageIndex - 1)}>
            Back
          </button>
        )}
        {isMultiPage && !isLastPage ? (
          <button type="button" onClick={handleNext}>
            Next
          </button>
        ) : (
          <button type="submit" disabled={submitting || props.isPreview}>
            {props.isPreview ? "Preview mode (submit disabled)" : submitting ? "Submitting…" : "Submit"}
          </button>
        )}
      </div>
    </form>
  );
}

function FieldInput({
  field,
  id,
  value,
  onChange,
  invalid,
  describedBy,
  slug,
  isPreview,
}: {
  field: FieldDefinition;
  id: string;
  value: unknown;
  onChange: (v: unknown) => void;
  invalid?: boolean;
  describedBy?: string;
  slug?: string;
  isPreview?: boolean;
}) {
  const cfg = field.config ?? {};
  const placeholder = field.placeholder ?? undefined;
  const a11y = {
    id,
    "aria-required": field.required || undefined,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
  } as const;
  const groupA11y = {
    "aria-required": field.required || undefined,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
  } as const;

  switch (field.type) {
    case "long_text":
      return (
        <textarea {...a11y} rows={4} placeholder={placeholder} maxLength={cfg.maxLength} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
      );
    case "email":
      return <input {...a11y} type="email" placeholder={placeholder} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "url":
      return <input {...a11y} type="url" placeholder={placeholder} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "phone":
      return <input {...a11y} type="tel" placeholder={placeholder} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return (
        <input {...a11y} type="number" min={cfg.min} max={cfg.max} step={cfg.step} placeholder={placeholder} value={(value as number) ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      );
    case "date":
      return <input {...a11y} type={cfg.includeTime ? "datetime-local" : "date"} min={cfg.minDate} max={cfg.maxDate} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "time":
      return <input {...a11y} type="time" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "checkbox":
      return (
        <label className="probe-option probe-option--inline" data-selected={Boolean(value)}>
          <input {...a11y} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          <span>{field.placeholder || "Yes"}</span>
        </label>
      );
    case "rating":
      return (
        <div role="group" {...groupA11y}>
          <RatingInput max={cfg.maxRating ?? 5} style={cfg.ratingStyle ?? "star"} value={typeof value === "number" ? value : 0} onChange={onChange} label={field.label} />
        </div>
      );
    case "linear_scale":
      return (
        <div role="group" {...groupA11y}>
          <LinearScaleInput min={cfg.scaleMin ?? 1} max={cfg.scaleMax ?? 5} minLabel={cfg.scaleMinLabel} maxLabel={cfg.scaleMaxLabel} value={typeof value === "number" ? value : null} onChange={onChange} />
        </div>
      );
    case "ranking":
      return (
        <div role="group" {...groupA11y}>
          <RankingInput options={cfg.options ?? []} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />
        </div>
      );
    case "address":
      return <AddressInput value={(value as Record<string, string>) ?? {}} onChange={onChange} describedBy={describedBy} />;
    case "signature":
      return <SignaturePad value={(value as string) ?? ""} onChange={onChange} />;
    case "file_upload":
      return (
        <FileUploadInput
          field={field}
          value={(value as FileUploadValue | null) ?? null}
          onChange={onChange}
          describedBy={describedBy}
          slug={slug}
          isPreview={isPreview}
        />
      );
    case "single_select":
      return (
        <div className="space-y-2" role="radiogroup" {...groupA11y}>
          {(cfg.options ?? []).map((o) => (
            <label key={o.value} className="probe-option" data-selected={value === o.value}>
              <input type="radio" name={id} checked={value === o.value} onChange={() => onChange(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    case "multi_select": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-2" role="group" {...groupA11y}>
          {(cfg.options ?? []).map((o) => (
            <label key={o.value} className="probe-option" data-selected={arr.includes(o.value)}>
              <input
                type="checkbox"
                checked={arr.includes(o.value)}
                onChange={(e) => {
                  if (e.target.checked) onChange([...arr, o.value]);
                  else onChange(arr.filter((v) => v !== o.value));
                }}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    }
    case "short_text":
    default:
      return <input {...a11y} type="text" placeholder={placeholder} maxLength={cfg.maxLength} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
}

function RatingInput({
  max,
  style,
  value,
  onChange,
  label,
}: {
  max: number;
  style: "star" | "number" | "emoji";
  value: number;
  onChange: (v: number) => void;
  label?: string;
}) {
  const items = Array.from({ length: max }).map((_, i) => i + 1);
  return (
    <div className="flex gap-2 flex-wrap">
      {items.map((n) => (
        <button
          type="button"
          key={n}
          onClick={() => onChange(n)}
          aria-label={`${n} of ${max}${label ? ` — ${label}` : ""}`}
          aria-pressed={value >= n}
          className="probe-rating-btn"
          style={{
            background: value >= n ? "var(--form-accent)" : "var(--form-surface)",
            color: value >= n ? "var(--form-accent-text)" : "var(--form-text)",
            border: "1px solid var(--form-border)",
            borderRadius: "var(--form-radius)",
            width: 40,
            height: 40,
            cursor: "pointer",
          }}
        >
          {style === "star" ? (value >= n ? "★" : "☆") : style === "emoji" ? "🍵" : n}
        </button>
      ))}
    </div>
  );
}

function LinearScaleInput({
  min,
  max,
  minLabel,
  maxLabel,
  value,
  onChange,
}: {
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  const items = Array.from({ length: Math.max(0, max - min + 1) }).map((_, i) => min + i);
  return (
    <div>
      <div className="flex gap-2 flex-wrap">
        {items.map((n) => (
          <button
            type="button"
            key={n}
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className="probe-rating-btn"
            style={{
              background: value === n ? "var(--form-accent)" : "var(--form-surface)",
              color: value === n ? "var(--form-accent-text)" : "var(--form-text)",
              border: "1px solid var(--form-border)",
              borderRadius: "var(--form-radius)",
              minWidth: 40,
              height: 40,
              padding: "0 10px",
              cursor: "pointer",
            }}
          >
            {n}
          </button>
        ))}
      </div>
      {(minLabel || maxLabel) && (
        <div className="flex justify-between text-xs mt-1" style={{ color: "var(--form-text-muted)" }}>
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}

function RankingInput({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  // Initialize to the option order on first interaction so the value is always
  // a complete ranking the schema accepts.
  const order = value.length === options.length ? value : options.map((o) => o.value);
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;

  function move(index: number, dir: -1 | 1) {
    const next = [...order];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <ol className="space-y-2">
      {order.map((v, i) => (
        <li key={v} className="probe-option" style={{ cursor: "default" }}>
          <span className="tabular-nums" style={{ color: "var(--form-text-muted)", minWidth: 20 }}>
            {i + 1}.
          </span>
          <span>{labelOf(v)}</span>
          <span className="flex gap-1">
            <button type="button" className="probe-rank-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button type="button" className="probe-rank-btn" aria-label="Move down" disabled={i === order.length - 1} onClick={() => move(i, 1)}>
              ↓
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}

function AddressInput({
  value,
  onChange,
  describedBy,
}: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  describedBy?: string;
}) {
  const set = (k: string, v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-2" aria-describedby={describedBy}>
      <input type="text" placeholder="Address line 1" value={value.line1 ?? ""} onChange={(e) => set("line1", e.target.value)} />
      <input type="text" placeholder="Address line 2 (optional)" value={value.line2 ?? ""} onChange={(e) => set("line2", e.target.value)} />
      <div className="flex gap-2">
        <input type="text" placeholder="City" value={value.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        <input type="text" placeholder="State / Region" value={value.state ?? ""} onChange={(e) => set("state", e.target.value)} />
      </div>
      <div className="flex gap-2">
        <input type="text" placeholder="Postal code" value={value.postal ?? ""} onChange={(e) => set("postal", e.target.value)} />
        <input type="text" placeholder="Country" value={value.country ?? ""} onChange={(e) => set("country", e.target.value)} />
      </div>
    </div>
  );
}

function SignaturePad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function end() {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  }
  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={500}
        height={160}
        onPointerDown={start}
        onPointerMove={draw}
        onPointerUp={end}
        onPointerLeave={end}
        style={{
          width: "100%",
          height: 160,
          background: "#fff",
          border: "1px solid var(--form-border)",
          borderRadius: "var(--form-radius)",
          touchAction: "none",
          cursor: "crosshair",
        }}
      />
      <button type="button" className="probe-btn-secondary mt-2" onClick={clear}>
        Clear signature
      </button>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileUploadInput({
  field,
  value,
  onChange,
  describedBy,
  slug,
  isPreview,
}: {
  field: FieldDefinition;
  value: FileUploadValue | null;
  onChange: (v: unknown) => void;
  describedBy?: string;
  slug?: string;
  isPreview?: boolean;
}) {
  const cfg = field.config ?? {};
  const presign = trpc.uploads.presign.useMutation();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const accept = (cfg.acceptedTypes ?? []).join(",") || undefined;

  async function handleSelect(file: File) {
    setError(null);
    // Preview mode (builder) has no real slug to presign against.
    if (isPreview || !slug) {
      setError("File uploads are disabled in preview.");
      return;
    }
    const maxMb = cfg.maxSizeMb ?? 10;
    if (file.size > maxMb * 1024 * 1024) {
      setError(`File exceeds the ${maxMb} MB limit.`);
      return;
    }
    const contentType = file.type || "application/octet-stream";
    setUploading(true);
    try {
      const { url, key } = await presign.mutateAsync({
        formSlug: slug,
        fieldId: field.id,
        filename: file.name,
        contentType,
        size: file.size,
      });
      const res = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentType },
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      onChange({ key, name: file.name, size: file.size, type: contentType });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function clear() {
    onChange(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (value) {
    return (
      <div aria-describedby={describedBy}>
        <div
          className="flex items-center gap-2 p-2 rounded"
          style={{ border: "1px solid var(--form-border)", borderRadius: "var(--form-radius)" }}
        >
          <span aria-hidden="true">📎</span>
          <span className="flex-1 truncate" style={{ color: "var(--form-text)" }}>
            {value.name}
          </span>
          <span className="text-xs" style={{ color: "var(--form-text-muted)" }}>
            {formatBytes(value.size)}
          </span>
          <button type="button" className="probe-btn-secondary" onClick={clear}>
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div aria-describedby={describedBy}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        aria-required={field.required || undefined}
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleSelect(file);
        }}
      />
      {uploading && (
        <p className="text-xs mt-1" style={{ color: "var(--form-text-muted)" }}>
          Uploading…
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
