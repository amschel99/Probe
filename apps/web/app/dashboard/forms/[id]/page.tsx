"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { fieldTypeSchema, type FieldTypeInput } from "@repo/services/validators";

import { FormRenderer } from "@/components/form-renderer";
import { nudgeChai } from "@/lib/chai";
import { trpc } from "@/lib/trpc";

import { FormTabs } from "./_components/form-tabs";
import { IntegrationsPanel } from "./_components/integrations-panel";

const FIELD_TYPES: { type: FieldTypeInput; label: string; emoji: string }[] = [
  { type: "short_text", label: "Short text", emoji: "Aa" },
  { type: "long_text", label: "Long text", emoji: "¶" },
  { type: "email", label: "Email", emoji: "@" },
  { type: "number", label: "Number", emoji: "#" },
  { type: "single_select", label: "Single select", emoji: "◉" },
  { type: "multi_select", label: "Multi-select", emoji: "☰" },
  { type: "checkbox", label: "Checkbox", emoji: "✓" },
  { type: "rating", label: "Rating", emoji: "★" },
  { type: "date", label: "Date", emoji: "▦" },
  { type: "phone", label: "Phone", emoji: "☏" },
  { type: "url", label: "URL", emoji: "⌁" },
  { type: "linear_scale", label: "Linear scale", emoji: "⇿" },
  { type: "ranking", label: "Ranking", emoji: "1²" },
  { type: "address", label: "Address", emoji: "⌖" },
  { type: "time", label: "Time", emoji: "◷" },
  { type: "signature", label: "Signature", emoji: "✎" },
  { type: "file_upload", label: "File upload", emoji: "⇪" },
  { type: "page_break", label: "Page break", emoji: "⎯" },
];

const DEFAULT_OPTIONS = [
  { label: "Option 1", value: "option-1" },
  { label: "Option 2", value: "option-2" },
];

function defaultConfigFor(type: FieldTypeInput): Record<string, unknown> {
  switch (type) {
    case "single_select":
    case "multi_select":
    case "ranking":
      return { options: DEFAULT_OPTIONS };
    case "linear_scale":
      return { scaleMin: 1, scaleMax: 5, scaleMinLabel: "", scaleMaxLabel: "" };
    case "file_upload":
      return { maxSizeMb: 10, acceptedTypes: [] };
    default:
      return {};
  }
}

export default function BuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const formQuery = trpc.forms.get.useQuery({ id });
  const themesQuery = trpc.themes.list.useQuery();
  const uploadsStatusQuery = trpc.uploads.status.useQuery();
  const utils = trpc.useUtils();

  const updateForm = trpc.forms.update.useMutation({
    onSuccess: () => utils.forms.get.invalidate({ id }),
    onError: (e) => toast.error(e.message),
  });
  const createField = trpc.fields.create.useMutation({ onSuccess: () => utils.forms.get.invalidate({ id }) });
  const updateField = trpc.fields.update.useMutation();
  const deleteField = trpc.fields.delete.useMutation({ onSuccess: () => utils.forms.get.invalidate({ id }) });
  const reorderFields = trpc.fields.reorder.useMutation({ onSuccess: () => utils.forms.get.invalidate({ id }) });
  const publishMutation = trpc.forms.publish.useMutation({
    onSuccess: () => {
      utils.forms.get.invalidate({ id });
      toast.success("Form published");
      nudgeChai("Form published. Probe ships every feature free — tips are welcome.");
    },
  });
  const unpublishMutation = trpc.forms.unpublish.useMutation({
    onSuccess: () => {
      utils.forms.get.invalidate({ id });
      toast("Form unpublished");
    },
  });
  const duplicateMutation = trpc.forms.duplicate.useMutation({
    onSuccess: (copy) => router.push(`/dashboard/forms/${copy.id}`),
  });
  const deleteForm = trpc.forms.delete.useMutation({ onSuccess: () => router.push("/dashboard/forms") });

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Auto-save title/description
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (formQuery.data) {
      setTitle(formQuery.data.title);
      setDescription(formQuery.data.description ?? "");
    }
  }, [formQuery.data]);

  useEffect(() => {
    if (!formQuery.data) return;
    if (title === formQuery.data.title && description === (formQuery.data.description ?? "")) return;
    const t = setTimeout(() => {
      updateForm.mutate({ id, title, description: description || null });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description]);

  if (formQuery.isLoading) return <p className="text-probe-700">Loading…</p>;
  if (!formQuery.data) return <p className="text-probe-700">Form not found.</p>;

  const form = formQuery.data;
  const selectedField = form.fields.find((f) => f.id === selectedFieldId);

  function addField(type: FieldTypeInput) {
    createField.mutate({
      formId: id,
      type,
      label:
        type === "page_break"
          ? "New page"
          : FIELD_TYPES.find((f) => f.type === type)?.label ?? "Field",
      required: false,
      order: form.fields.length,
      config: defaultConfigFor(type),
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = form.fields.findIndex((f) => f.id === active.id);
    const newIndex = form.fields.findIndex((f) => f.id === over.id);
    const next = arrayMove(form.fields, oldIndex, newIndex);
    reorderFields.mutate({
      formId: id,
      fields: next.map((f, i) => ({ id: f.id, order: i })),
    });
  }

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/f/${form.slug}`
      : `/f/${form.slug}`;

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-probe-700">
          <Link href="/dashboard/forms" className="hover:underline">Forms</Link>
          <span>/</span>
          <span className="font-medium text-probe-900">{form.title}</span>
          <span className="px-2 py-0.5 rounded-full bg-probe-100 uppercase tracking-wide">{form.status}</span>
        </div>
        <FormTabs
          id={id}
          responseCount={form.responseCount}
          action={
            <>
              <button onClick={() => setPreviewOpen((v) => !v)} className="btn btn-ghost text-sm">
                {previewOpen ? "Builder" : "Preview"}
              </button>
              {form.status === "published" ? (
                <button onClick={() => unpublishMutation.mutate({ id })} className="btn btn-ghost text-sm">Unpublish</button>
              ) : (
                <button onClick={() => publishMutation.mutate({ id })} className="btn btn-primary text-sm">Publish</button>
              )}
            </>
          }
        />
      </div>

      {previewOpen ? (
        // Render the preview on the theme's own page background — exactly like the
        // public /f/<slug> page — so what you see here matches what visitors see
        // (no "themed form on a different-coloured page" mismatch).
        <div
          className="rounded-2xl border border-probe-200 overflow-hidden py-10 px-4"
          style={{ background: form.theme.config.background }}
        >
          <FormRenderer
            title={form.title}
            description={form.description ?? undefined}
            fields={form.fields.map((f) => ({
              id: f.id,
              type: f.type,
              label: f.label,
              required: f.required,
              placeholder: f.placeholder ?? null,
              helpText: f.helpText ?? null,
              config: f.config ?? {},
              conditionalLogic: f.conditionalLogic ?? null,
            }))}
            theme={form.theme.config}
            layout={form.settings.layout}
            showProgressBar={form.settings.showProgressBar}
            scoring={form.settings.scoring}
            isPreview
            onSubmit={async () => {}}
          />
        </div>
      ) : (
        <div className="grid grid-cols-[220px_1fr_300px] gap-4">
          {/* Left: field palette */}
          <div className="card sticky top-4 h-fit">
            <div className="text-xs font-bold uppercase text-probe-700 mb-3">Add field</div>
            <div className="space-y-1">
              {FIELD_TYPES.map((t) => {
                // File upload requires R2 storage; disable when not configured.
                const storageOff =
                  t.type === "file_upload" && uploadsStatusQuery.data?.configured === false;
                return (
                  <button
                    key={t.type}
                    onClick={() => addField(t.type)}
                    disabled={storageOff}
                    title={
                      storageOff ? "Configure R2 storage to enable file uploads" : undefined
                    }
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-probe-50 text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <span className="w-5 text-center font-mono text-[12px] text-probe-500">{t.emoji}</span>
                    <span>{t.label}</span>
                    {storageOff && (
                      <span className="ml-auto text-[10px] text-probe-500">off</span>
                    )}
                  </button>
                );
              })}
            </div>
            {uploadsStatusQuery.data?.configured === false && (
              <p className="mt-2 text-[11px] leading-snug text-probe-700">
                Configure R2 storage to enable file uploads.
              </p>
            )}
            <div className="mt-4 pt-4 border-t border-probe-100 space-y-2">
              <div className="text-xs font-bold uppercase text-probe-700">Theme</div>
              <select
                className="input text-sm"
                value={form.themeId}
                onChange={(e) => updateForm.mutate({ id, themeId: e.target.value })}
              >
                {themesQuery.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 pt-4 border-t border-probe-100 space-y-1">
              <button
                onClick={() => duplicateMutation.mutate({ id })}
                className="w-full text-left text-sm py-1 px-2 rounded-lg hover:bg-probe-50"
              >
                Duplicate form
              </button>
              <button
                onClick={() => {
                  if (confirm("Delete this form? Responses are gone too.")) {
                    deleteForm.mutate({ id });
                  }
                }}
                className="w-full text-left text-sm py-1 px-2 rounded-lg hover:bg-red-50 text-red-700"
              >
                Delete form
              </button>
            </div>
          </div>

          {/* Center: canvas */}
          <div className="card">
            <input
              className="text-2xl font-bold display bg-transparent w-full mb-2 border-none focus:outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="text-probe-700 bg-transparent w-full mb-6 border-none focus:outline-none resize-none"
              rows={1}
              placeholder="Add a description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={form.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {form.fields.map((field) => (
                    <SortableField
                      key={field.id}
                      field={field}
                      selected={selectedFieldId === field.id}
                      onSelect={() => setSelectedFieldId(field.id)}
                      onDelete={() => deleteField.mutate({ id: field.id })}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {form.fields.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-probe-200 rounded-xl">
                <p className="text-probe-700">Add fields from the left panel.</p>
              </div>
            )}

            <div className="mt-4 text-xs text-probe-700">
              Share URL: <Link href={`/f/${form.slug}`} target="_blank" className="underline">{shareUrl}</Link>
            </div>
          </div>

          {/* Right: settings */}
          <div className="space-y-4 sticky top-4 h-fit">
            <div className="card">
              {selectedField ? (
                <FieldSettings
                  field={selectedField}
                  onChange={(patch) => updateField.mutate({ id: selectedField.id, ...patch })}
                />
              ) : (
                <FormSettings form={form} onChange={(patch) => updateForm.mutate({ id, ...patch })} />
              )}
            </div>
            {!selectedField && <IntegrationsPanel formId={id} />}
          </div>
        </div>
      )}
    </div>
  );
}

function SortableField({
  field,
  selected,
  onSelect,
  onDelete,
}: {
  field: { id: string; label: string; type: string; required: boolean };
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`flex items-center gap-2 p-3 rounded-xl border ${
        selected ? "border-probe-500 ring-2 ring-probe-500" : "border-probe-200"
      } bg-surface cursor-pointer`}
    >
      <span {...attributes} {...listeners} className="cursor-grab text-probe-500" aria-label="Drag">
        ⠿
      </span>
      <div className="flex-1">
        <div className="font-semibold text-sm">
          {field.label}
          {field.required && <span className="text-probe-500">*</span>}
        </div>
        <div className="text-xs text-probe-700">{field.type.replace("_", " ")}</div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm("Delete this field?")) onDelete();
        }}
        className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded"
      >
        Delete
      </button>
    </div>
  );
}

function FieldSettings({
  field,
  onChange,
}: {
  field: {
    id: string;
    label: string;
    placeholder: string | null;
    helpText: string | null;
    required: boolean;
    type: string;
    config: Record<string, unknown>;
  };
  onChange: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase text-probe-700">Field settings</div>
      <div>
        <label className="label text-sm">Label</label>
        <input
          className="input text-sm"
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </div>
      <div>
        <label className="label text-sm">Placeholder</label>
        <input
          className="input text-sm"
          value={field.placeholder ?? ""}
          onChange={(e) => onChange({ placeholder: e.target.value || null })}
        />
      </div>
      <div>
        <label className="label text-sm">Help text</label>
        <input
          className="input text-sm"
          value={field.helpText ?? ""}
          onChange={(e) => onChange({ helpText: e.target.value || null })}
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => onChange({ required: e.target.checked })}
        />
        <span className="text-sm">Required</span>
      </label>

      {(field.type === "single_select" ||
        field.type === "multi_select" ||
        field.type === "ranking") && (
        <OptionsEditor
          withScores={field.type !== "ranking"}
          value={(field.config?.options as { label: string; value: string; score?: number }[]) ?? []}
          onChange={(options) => onChange({ config: { ...(field.config ?? {}), options } })}
        />
      )}

      {field.type === "rating" && (
        <div>
          <label className="label text-sm">Max rating</label>
          <input
            type="number"
            min={1}
            max={10}
            className="input text-sm"
            value={(field.config?.maxRating as number) ?? 5}
            onChange={(e) =>
              onChange({
                config: { ...(field.config ?? {}), maxRating: Number(e.target.value) },
              })
            }
          />
        </div>
      )}

      {field.type === "linear_scale" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label text-sm">Min</label>
            <input
              type="number"
              className="input text-sm"
              value={(field.config?.scaleMin as number) ?? 1}
              onChange={(e) => onChange({ config: { ...(field.config ?? {}), scaleMin: Number(e.target.value) } })}
            />
          </div>
          <div>
            <label className="label text-sm">Max</label>
            <input
              type="number"
              className="input text-sm"
              value={(field.config?.scaleMax as number) ?? 5}
              onChange={(e) => onChange({ config: { ...(field.config ?? {}), scaleMax: Number(e.target.value) } })}
            />
          </div>
          <div>
            <label className="label text-sm">Min label</label>
            <input
              className="input text-sm"
              placeholder="e.g. Disagree"
              value={(field.config?.scaleMinLabel as string) ?? ""}
              onChange={(e) => onChange({ config: { ...(field.config ?? {}), scaleMinLabel: e.target.value } })}
            />
          </div>
          <div>
            <label className="label text-sm">Max label</label>
            <input
              className="input text-sm"
              placeholder="e.g. Agree"
              value={(field.config?.scaleMaxLabel as string) ?? ""}
              onChange={(e) => onChange({ config: { ...(field.config ?? {}), scaleMaxLabel: e.target.value } })}
            />
          </div>
        </div>
      )}

      {field.type === "file_upload" && (
        <div className="space-y-3">
          <div>
            <label className="label text-sm">Max file size (MB)</label>
            <input
              type="number"
              min={1}
              max={100}
              className="input text-sm"
              value={(field.config?.maxSizeMb as number) ?? 10}
              onChange={(e) =>
                onChange({
                  config: {
                    ...(field.config ?? {}),
                    maxSizeMb: e.target.value ? Number(e.target.value) : undefined,
                  },
                })
              }
            />
          </div>
          <div>
            <label className="label text-sm">Accepted types</label>
            <input
              className="input text-sm"
              placeholder="e.g. image/*, .pdf, application/zip"
              value={((field.config?.acceptedTypes as string[]) ?? []).join(", ")}
              onChange={(e) =>
                onChange({
                  config: {
                    ...(field.config ?? {}),
                    acceptedTypes: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
            />
            <p className="text-xs text-probe-700 mt-1">
              Comma-separated mime types or extensions. Leave blank to accept any file.
            </p>
          </div>
        </div>
      )}

      {field.type === "page_break" && (
        <p className="text-xs text-probe-700">
          The label is shown as the page title and help text as its intro. Page breaks
          split the form into multiple steps with a progress bar.
        </p>
      )}

      {field.type !== "page_break" && (
        <details className="text-sm">
          <summary className="cursor-pointer text-probe-700">Advanced</summary>
          <label className="flex items-center gap-2 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={Boolean(field.config?.hidden)}
              onChange={(e) => onChange({ config: { ...(field.config ?? {}), hidden: e.target.checked } })}
            />
            <span>Hidden field (prefilled from URL, not shown)</span>
          </label>
          {field.config?.hidden ? (
            <div className="mt-2">
              <label className="label text-sm">URL query key</label>
              <input
                className="input text-sm"
                placeholder="defaults to field id"
                value={(field.config?.prefillKey as string) ?? ""}
                onChange={(e) => onChange({ config: { ...(field.config ?? {}), prefillKey: e.target.value } })}
              />
            </div>
          ) : null}
        </details>
      )}
    </div>
  );
}

type EditorOption = { label: string; value: string; score?: number };

function OptionsEditor({
  value,
  onChange,
  withScores,
}: {
  value: EditorOption[];
  onChange: (options: EditorOption[]) => void;
  withScores?: boolean;
}) {
  return (
    <div>
      <div className="label text-sm">Options</div>
      <div className="space-y-2">
        {value.map((opt, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="input text-sm flex-1"
              value={opt.label}
              placeholder="Label"
              onChange={(e) => {
                const next = [...value];
                next[i] = {
                  ...next[i],
                  label: e.target.value,
                  value: e.target.value.toLowerCase().replace(/\s+/g, "_") || `option_${i + 1}`,
                };
                onChange(next);
              }}
            />
            {withScores && (
              <input
                type="number"
                className="input text-sm w-16"
                title="Score (quiz mode)"
                placeholder="pts"
                value={opt.score ?? ""}
                onChange={(e) => {
                  const next = [...value];
                  next[i] = {
                    ...next[i],
                    score: e.target.value === "" ? undefined : Number(e.target.value),
                  };
                  onChange(next);
                }}
              />
            )}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="px-2 text-red-600"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...value, { label: "Option", value: `option_${value.length + 1}` }])}
          className="btn btn-ghost text-sm"
        >
          + Add option
        </button>
      </div>
    </div>
  );
}

function FormSettings({
  form,
  onChange,
}: {
  form: {
    visibility: "public" | "unlisted";
    settings: {
      notifyCreator: boolean;
      sendConfirmationEmail: boolean;
      successMessage: string;
      redirectUrl?: string | null;
      layout?: "classic" | "one_per_page";
      showProgressBar?: boolean;
      scoring?: { enabled: boolean; outcomes: ScoringOutcomeRow[] };
    };
    maxResponses: number | null;
  };
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const scoring = form.settings.scoring ?? { enabled: false, outcomes: [] };
  const setScoring = (next: { enabled: boolean; outcomes: ScoringOutcomeRow[] }) =>
    onChange({ settings: { ...form.settings, scoring: next } });
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase text-probe-700">Form settings</div>
      <div>
        <label className="label text-sm">Visibility</label>
        <select
          className="input text-sm"
          value={form.visibility}
          onChange={(e) => onChange({ visibility: e.target.value })}
        >
          <option value="unlisted">Unlisted</option>
          <option value="public">Public</option>
        </select>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.settings.notifyCreator}
          onChange={(e) =>
            onChange({ settings: { ...form.settings, notifyCreator: e.target.checked } })
          }
        />
        <span className="text-sm">Email me on submissions</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.settings.sendConfirmationEmail}
          onChange={(e) =>
            onChange({ settings: { ...form.settings, sendConfirmationEmail: e.target.checked } })
          }
        />
        <span className="text-sm">Send confirmation email</span>
      </label>
      <div>
        <label className="label text-sm">Success message</label>
        <textarea
          rows={2}
          className="input text-sm"
          // Uncontrolled + save-on-blur: avoids a mutation per keystroke and the
          // value snapping back from server state mid-typing.
          defaultValue={form.settings.successMessage}
          onBlur={(e) =>
            onChange({ settings: { ...form.settings, successMessage: e.target.value.trim() } })
          }
        />
      </div>
      <div>
        <label className="label text-sm">Redirect after submit (optional)</label>
        <input
          type="url"
          className="input text-sm"
          placeholder="https://your-site.com/thank-you"
          // Uncontrolled + save-on-blur. A controlled value here re-validated as a
          // URL on every keystroke, so partial input ("h", "ht"…) failed and the
          // field snapped back to empty — you couldn't type. Saving on blur sends
          // only the complete value; empty/whitespace clears it (→ null).
          defaultValue={form.settings.redirectUrl ?? ""}
          onBlur={(e) =>
            onChange({ settings: { ...form.settings, redirectUrl: e.target.value.trim() || null } })
          }
        />
      </div>
      <div>
        <label className="label text-sm">Layout</label>
        <select
          className="input text-sm"
          value={form.settings.layout ?? "classic"}
          onChange={(e) => onChange({ settings: { ...form.settings, layout: e.target.value } })}
        >
          <option value="classic">Classic (all on one page)</option>
          <option value="one_per_page">One question per page</option>
        </select>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.settings.showProgressBar !== false}
          onChange={(e) => onChange({ settings: { ...form.settings, showProgressBar: e.target.checked } })}
        />
        <span className="text-sm">Show progress bar (multi-page)</span>
      </label>
      <div>
        <label className="label text-sm">Max responses (optional)</label>
        <input
          type="number"
          min={1}
          className="input text-sm"
          value={form.maxResponses ?? ""}
          onChange={(e) =>
            onChange({ maxResponses: e.target.value ? Number(e.target.value) : null })
          }
        />
      </div>

      {/* Quiz scoring */}
      <div className="border-t border-probe-200 pt-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={scoring.enabled}
            onChange={(e) => setScoring({ ...scoring, enabled: e.target.checked })}
          />
          <span className="text-sm font-semibold">Quiz scoring</span>
        </label>
        {scoring.enabled && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-probe-700">
              Add option/rating scores above. Define outcomes by score range:
            </p>
            {scoring.outcomes.map((o, i) => (
              <div key={i} className="space-y-1 border border-probe-100 rounded-lg p-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="input text-sm w-16"
                    placeholder="min"
                    value={o.min}
                    onChange={(e) => {
                      const next = [...scoring.outcomes];
                      next[i] = { ...o, min: Number(e.target.value) };
                      setScoring({ ...scoring, outcomes: next });
                    }}
                  />
                  <input
                    type="number"
                    className="input text-sm w-16"
                    placeholder="max"
                    value={o.max}
                    onChange={(e) => {
                      const next = [...scoring.outcomes];
                      next[i] = { ...o, max: Number(e.target.value) };
                      setScoring({ ...scoring, outcomes: next });
                    }}
                  />
                  <input
                    className="input text-sm flex-1"
                    placeholder="Outcome title"
                    value={o.title}
                    onChange={(e) => {
                      const next = [...scoring.outcomes];
                      next[i] = { ...o, title: e.target.value };
                      setScoring({ ...scoring, outcomes: next });
                    }}
                  />
                  <button
                    type="button"
                    className="px-2 text-red-600"
                    onClick={() => setScoring({ ...scoring, outcomes: scoring.outcomes.filter((_, j) => j !== i) })}
                  >
                    ×
                  </button>
                </div>
                <textarea
                  rows={2}
                  className="input text-sm"
                  placeholder="Message shown for this score range"
                  value={o.message}
                  onChange={(e) => {
                    const next = [...scoring.outcomes];
                    next[i] = { ...o, message: e.target.value };
                    setScoring({ ...scoring, outcomes: next });
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost text-sm"
              onClick={() =>
                setScoring({
                  ...scoring,
                  outcomes: [...scoring.outcomes, { min: 0, max: 0, title: "", message: "" }],
                })
              }
            >
              + Add outcome
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type ScoringOutcomeRow = { min: number; max: number; title: string; message: string };
