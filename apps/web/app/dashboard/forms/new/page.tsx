"use client";

import { zodResolver } from "@/lib/zod-resolver";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createFormSchema, type CreateFormInput } from "@repo/services/validators";

import { trpc } from "@/lib/trpc";

function NewFormForm() {
  const router = useRouter();
  const search = useSearchParams();
  const themesQuery = trpc.themes.list.useQuery();
  const aiStatus = trpc.ai.status.useQuery();
  const [aiPrompt, setAiPrompt] = useState("");
  const createMutation = trpc.forms.create.useMutation({
    onSuccess: (form) => {
      toast.success("Form created");
      router.push(`/dashboard/forms/${form.id}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const generateMutation = trpc.ai.generateForm.useMutation({
    onSuccess: (r) => {
      toast.success(`Generated a form with ${r.fieldCount} fields`);
      router.push(`/dashboard/forms/${r.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateFormInput>({
    resolver: zodResolver(createFormSchema),
    defaultValues: { visibility: "unlisted", themeId: search.get("theme") ?? "" },
  });

  useEffect(() => {
    const t = search.get("theme");
    if (t) setValue("themeId", t);
  }, [search, setValue]);

  const selectedThemeId = watch("themeId");
  // AI generation uses the chosen theme, or the first available one as a fallback.
  const aiThemeId = selectedThemeId || themesQuery.data?.[0]?.id;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="display text-3xl font-bold">New form</h1>
        <p className="text-probe-700">Title + theme to start. You can change anything later.</p>
      </div>

      {/* AI generation — shown only when the user has connected their Anthropic key */}
      {aiStatus.data?.hasKey ? (
        <div className="card space-y-3 ring-1 ring-probe-500/30">
          <div className="font-bold flex items-center gap-2"><span className="text-probe-500">✦</span> Generate with AI</div>
          <p className="help">
            Describe your form in plain English — Claude drafts the fields. Uses your own
            Anthropic key; you can tweak everything after.
          </p>
          <textarea
            className="input"
            rows={3}
            placeholder="A customer feedback form: a 1–5 star rating, what they liked, what to improve, and an optional email to follow up."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={generateMutation.isPending || aiPrompt.trim().length < 3 || !aiThemeId}
            onClick={() => aiThemeId && generateMutation.mutate({ prompt: aiPrompt, themeId: aiThemeId })}
          >
            {generateMutation.isPending ? "Generating…" : "Generate form"}
          </button>
          <div className="text-xs text-probe-700">
            Or fill in the details manually below.
          </div>
        </div>
      ) : aiStatus.isSuccess ? (
        <div className="card text-sm text-probe-700">
          <span className="text-probe-500">✦</span> Want AI to draft your form?{" "}
          <Link href="/dashboard/settings" className="underline">
            Add your Anthropic API key
          </Link>{" "}
          in settings — Probe never charges for AI.
        </div>
      ) : null}

      <form className="card space-y-4" onSubmit={handleSubmit((v) => createMutation.mutate(v))}>
        <div>
          <label className="label">Title</label>
          <input className="input" placeholder="The 2025 Naptime Survey" {...register("title")} />
          {errors.title && <p className="error">{errors.title.message}</p>}
        </div>

        <div>
          <label className="label">Description (optional)</label>
          <textarea className="input" rows={2} {...register("description")} />
        </div>

        <div>
          <label className="label">Visibility</label>
          <select className="input" {...register("visibility")}>
            <option value="unlisted">Unlisted (link-only)</option>
            <option value="public">Public (appears in /explore)</option>
          </select>
        </div>

        <div>
          <label className="label">Theme</label>
          <div className="grid sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
            {themesQuery.data?.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setValue("themeId", t.id, { shouldValidate: true })}
                className={`text-left p-2 rounded-xl border ${
                  selectedThemeId === t.id ? "border-probe-500 ring-2 ring-probe-500" : "border-probe-200"
                }`}
                style={{ background: t.config.background, fontFamily: t.config.fontFamily }}
              >
                {/* Label sits on the theme's own surface — `text` is designed to be
                    read on `surface`, not on the page `background` (which can be
                    dark, e.g. Windows Vista → unreadable otherwise). */}
                <div
                  className="rounded-lg px-3 py-2"
                  style={{
                    background: t.config.surface,
                    color: t.config.text,
                    border: `1px solid ${t.config.border}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: t.config.accent }} />
                    <span className="font-bold text-sm">{t.name}</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: t.config.textMuted }}>
                    {t.category}
                  </div>
                </div>
                <div
                  className="mt-2 ml-1 h-1.5 w-10 rounded-full"
                  style={{ background: t.config.accent }}
                  aria-hidden
                />
              </button>
            ))}
          </div>
          {errors.themeId && <p className="error">{errors.themeId.message}</p>}
        </div>

        <button className="btn btn-primary" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating…" : "Create form"}
        </button>
      </form>
    </div>
  );
}

export default function NewFormPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto">Loading…</div>}>
      <NewFormForm />
    </Suspense>
  );
}
