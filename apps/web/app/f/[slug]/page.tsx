import type { RouterOutputs } from "@repo/trpc/client";
import { notFound } from "next/navigation";

import { api } from "@/lib/trpc-server";
import { FormFiller } from "./form-filler";

export const dynamic = "force-dynamic";

export default async function PublicFormPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { password?: string };
}) {
  let result: RouterOutputs["public"]["getForm"] | null = null;
  try {
    result = await api.public.getForm.query({
      slug: params.slug,
      password: searchParams.password,
    });
  } catch (err) {
    // TRPCClientError carries the procedure's error code at `err.data.code`
    // (with `err.shape.data.code` as a fallback) — not at `err.code`.
    const code =
      (err as { data?: { code?: string } })?.data?.code ??
      (err as { shape?: { data?: { code?: string } } })?.shape?.data?.code;
    if (code === "NOT_FOUND") return notFound();
    if (code === "PRECONDITION_FAILED") {
      return (
        <div className="min-h-screen flex items-center justify-center bg-probe-50 p-6">
          <div className="card text-center max-w-md">
            <div className="text-3xl mb-4 text-probe-500" aria-hidden>✦</div>
            <h1 className="display text-2xl font-bold">This form is closed.</h1>
            <p className="text-probe-700 mt-2">It either expired or hit its response limit.</p>
          </div>
        </div>
      );
    }
    throw err;
  }

  if (!result) return notFound();

  if (result.passwordRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-probe-50 p-6">
        <form className="card max-w-md w-full">
          <div className="text-3xl mb-2 font-mono text-probe-500" aria-hidden>◈</div>
          <h1 className="display text-xl font-bold">Password required</h1>
          <p className="text-probe-700 text-sm mt-1 mb-4">
            This form is password protected.
          </p>
          <input
            name="password"
            type="password"
            className="input"
            placeholder="Enter password"
            required
          />
          <button type="submit" className="btn btn-primary w-full mt-3">
            Unlock
          </button>
        </form>
      </div>
    );
  }

  return (
    // Tally-style: one full-bleed surface, content in a single column from the
    // top. The theme's `surface` (not `background`) is what its text colors are
    // designed to be read on.
    <div
      className="min-h-[100dvh] px-5 pt-12 pb-24 sm:px-8 sm:pt-20"
      style={{ background: result.theme?.config.surface ?? "#FFFFFF" }}
    >
      <FormFiller
        slug={params.slug}
        title={result.form!.title}
        description={result.form!.description}
        fields={result.fields.map((f: (typeof result.fields)[number]) => ({
          id: f.id,
          type: f.type,
          label: f.label,
          required: f.required,
          placeholder: f.placeholder ?? null,
          helpText: f.helpText ?? null,
          config: f.config ?? {},
          conditionalLogic: f.conditionalLogic ?? null,
        }))}
        theme={result.theme!.config}
        successMessage={result.form!.settings.successMessage}
        redirectUrl={result.form!.settings.redirectUrl}
        layout={result.form!.settings.layout}
        showProgressBar={result.form!.settings.showProgressBar}
        scoring={result.form!.settings.scoring}
        password={searchParams.password}
      />
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-4 right-4 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm hover:text-neutral-900"
      >
        Made with <span className="font-bold">Probe</span>
      </a>
    </div>
  );
}
