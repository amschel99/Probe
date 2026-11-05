"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";

type EditPlan = NonNullable<ReturnType<typeof trpc.ai.proposeEdit.useMutation>["data"]>;

const EXAMPLES = [
  "Add a question asking which city they're based in",
  "Make phone number optional",
  "Remove the question about budget",
  "Turn the experience question into a dropdown: 0-2, 3-5, 6-10, 10+ years",
];

/**
 * Describe changes in plain words, review what the AI proposes, then apply.
 * Nothing is saved until Apply, and the form keeps its link.
 */
export function AiEditPanel({
  formId,
  status,
  onClose,
}: {
  formId: string;
  status: "draft" | "published" | "archived";
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const aiStatus = trpc.ai.status.useQuery();
  const [instruction, setInstruction] = useState("");
  const [plan, setPlan] = useState<EditPlan | null>(null);
  const [publish, setPublish] = useState(status !== "published");

  const propose = trpc.ai.proposeEdit.useMutation({
    onSuccess: (p) => setPlan(p),
    onError: (e) => toast.error(e.message),
  });
  const apply = trpc.ai.applyEdit.useMutation({
    onSuccess: (r) => {
      utils.forms.get.invalidate({ id: formId });
      toast.success(
        r.published ? `Changes are live at /f/${r.slug}` : "Changes saved. Publish when you're ready.",
      );
      setPlan(null);
      setInstruction("");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  if (aiStatus.isSuccess && !aiStatus.data.hasKey) {
    return (
      <div className="card text-sm text-probe-700">
        To edit forms with AI,{" "}
        <Link href="/dashboard/settings" className="underline">
          connect a provider in Settings
        </Link>
        .
      </div>
    );
  }

  const changes = plan
    ? plan.fields.filter((f) => f.change !== "unchanged").length +
      plan.removed.length
    : 0;
  const answersLost = plan?.removed.reduce((n, r) => n + r.answers, 0) ?? 0;

  function submit() {
    if (instruction.trim().length >= 3) propose.mutate({ formId, instruction });
  }

  return (
    <div className="card space-y-4 border-probe-900">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="ai-edit" className="font-display text-2xl">
          What should change?
        </label>
        <div className="flex items-center gap-3">
          {aiStatus.data?.providerLabel && (
            <span className="font-mono text-[11px] text-probe-700">
              {aiStatus.data.providerLabel} · {aiStatus.data.model}
            </span>
          )}
          <button type="button" onClick={onClose} className="text-sm text-probe-700 hover:underline">
            Close
          </button>
        </div>
      </div>

      <textarea
        id="ai-edit"
        className="input text-[15px]"
        rows={3}
        maxLength={2000}
        placeholder="e.g. Add a question about dietary needs, make LinkedIn optional, and remove the referral question."
        value={instruction}
        onChange={(e) => {
          setInstruction(e.target.value);
          setPlan(null);
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
      />
      {!plan && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setInstruction(ex)}
              className="border border-probe-200 px-2.5 py-1 font-mono text-[12px] text-probe-700 hover:border-probe-900 hover:text-probe-900"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {!plan && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={propose.isPending || instruction.trim().length < 3}
          onClick={submit}
        >
          {propose.isPending ? "Working out the changes…" : "Show me the changes"}
        </button>
      )}

      {plan && (
        <div className="space-y-3">
          {changes === 0 ? (
            <p className="text-sm text-probe-700">
              No changes to the questions. Try describing the change differently.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {plan.fields.map((f, i) =>
                f.change === "unchanged" ? null : (
                  <li key={f.id ?? `new-${i}`} className="flex gap-2">
                    <span
                      className={`w-16 shrink-0 font-mono text-[11px] uppercase ${
                        f.change === "added" ? "text-green-700" : "text-probe-700"
                      }`}
                    >
                      {f.change === "added" ? "Add" : "Change"}
                    </span>
                    <span>
                      {f.label}
                      {f.change === "changed" && (
                        <span className="text-probe-500"> ({f.details.join(", ")})</span>
                      )}
                    </span>
                  </li>
                ),
              )}
              {plan.removed.map((r) => (
                <li key={r.id} className="flex gap-2">
                  <span className="w-16 shrink-0 font-mono text-[11px] uppercase text-red-700">Remove</span>
                  <span>
                    {r.label}
                    {r.answers > 0 && (
                      <span className="text-red-700">
                        {" "}
                        ({r.answers} answer{r.answers === 1 ? "" : "s"} will be deleted)
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {status === "published" ? (
            <p className="text-xs text-probe-700">
              This form is live. Changes go live straight away at the same link.
            </p>
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
              Publish after applying
            </label>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-primary"
              disabled={apply.isPending || changes === 0}
              onClick={() => {
                if (
                  answersLost > 0 &&
                  !confirm(`This deletes ${answersLost} existing answer${answersLost === 1 ? "" : "s"}. Continue?`)
                ) {
                  return;
                }
                apply.mutate({
                  formId,
                  publish,
                  draft: {
                    title: plan.title,
                    description: plan.description,
                    fields: plan.fields.map((f) => ({
                      id: f.id,
                      type: f.type,
                      label: f.label,
                      required: f.required,
                      placeholder: f.placeholder,
                      helpText: f.helpText,
                      options: f.options?.map((o) => ({ label: o.label, value: o.value })),
                    })),
                  },
                });
              }}
            >
              {apply.isPending ? "Applying…" : "Apply changes"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPlan(null)}>
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
