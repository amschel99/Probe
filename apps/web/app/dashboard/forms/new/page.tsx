"use client";

import { zodResolver } from "@/lib/zod-resolver";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createFormSchema, type CreateFormInput } from "@repo/services/validators";

import { trpc } from "@/lib/trpc";

const AI_EXAMPLES: { label: string; prompt: string }[] = [
  {
    label: "Event signup",
    prompt: "An event registration form: name, email, phone, organisation, which day(s) they're attending, dietary requirements, and an optional note.",
  },
  {
    label: "Customer feedback",
    prompt: "A customer feedback form: overall rating out of 5, what they liked, what we should improve, how likely they are to recommend us (1-10), and an optional email for follow-up.",
  },
  {
    label: "Job application",
    prompt: "A job application for a software engineer role: full name, email, phone, LinkedIn URL, years of experience, preferred start date, salary expectation, and why they want to join.",
  },
  {
    label: "Investor intake",
    prompt: "An intake form for founders applying for funding: founder name, email, company, website, sector, stage, amount raising, monthly revenue, and a short description of the business.",
  },
];

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
        <h1 className="display text-4xl">New form</h1>
        <p className="text-probe-700">
          Describe it and let AI draft the questions, or set it up yourself below.
        </p>
      </div>

      {/* AI-first, Tally-style: describe the form, get a draft in the builder. */}
      {aiStatus.data?.hasKey ? (
        <div className="card space-y-4 border-probe-900">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="ai-prompt" className="font-display text-2xl">
              What do you want to ask?
            </label>
            <span className="font-mono text-[11px] text-probe-700">
              {aiStatus.data.providerLabel} · {aiStatus.data.model}
            </span>
          </div>
          <textarea
            id="ai-prompt"
            className="input text-[15px]"
            rows={4}
            maxLength={2000}
            placeholder="e.g. A registration form for a 2-day founders' retreat in Nairobi: name, email, company, role, dietary needs, which sessions they'll attend, and how they heard about us."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && aiPrompt.trim().length >= 3 && aiThemeId) {
                generateMutation.mutate({ prompt: aiPrompt, themeId: aiThemeId });
              }
            }}
          />
          <div className="flex flex-wrap gap-2">
            {AI_EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => setAiPrompt(ex.prompt)}
                className="border border-probe-200 px-2.5 py-1 font-mono text-[12px] text-probe-700 hover:border-probe-900 hover:text-probe-900"
              >
                {ex.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-primary"
              disabled={generateMutation.isPending || aiPrompt.trim().length < 3 || !aiThemeId}
              onClick={() => aiThemeId && generateMutation.mutate({ prompt: aiPrompt, themeId: aiThemeId })}
            >
              {generateMutation.isPending ? "Drafting your form…" : "Generate form"}
            </button>
            <span className="text-xs text-probe-700">
              Opens in the builder so you can edit everything.
            </span>
          </div>
        </div>
      ) : aiStatus.isSuccess ? (
        <div className="card text-sm text-probe-700">
          Want AI to draft your forms?{" "}
          <Link href="/dashboard/settings" className="underline">
            Connect a provider in Settings
          </Link>{" "}
          — Claude, OpenAI, DeepSeek, Gemini and more.
        </div>
      ) : null}

      <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-probe-700">
        <span className="h-px flex-1 bg-probe-200" />
        or start from scratch
        <span className="h-px flex-1 bg-probe-200" />
      </div>

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
                className={`text-left p-2 rounded-[2px] border ${
                  selectedThemeId === t.id ? "border-probe-500 ring-2 ring-probe-500" : "border-probe-200"
                }`}
                style={{ background: t.config.background, fontFamily: t.config.fontFamily }}
              >
                {/* Label sits on the theme's own surface — `text` is designed to be
                    read on `surface`, not on the page `background` (which can be
                    dark, e.g. Windows Vista → unreadable otherwise). */}
                <div
                  className="rounded-[2px] px-3 py-2"
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
