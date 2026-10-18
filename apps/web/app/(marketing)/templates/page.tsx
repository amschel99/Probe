import type { RouterOutputs } from "@repo/trpc/client";
import Link from "next/link";

import { api } from "@/lib/trpc-server";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  let themes: RouterOutputs["themes"]["list"] = [];
  try {
    themes = await api.themes.list.query();
  } catch {}

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="display text-4xl font-bold">Templates</h1>
      <p className="text-probe-700 mt-2 mb-6">
        Themes are starting points. Pick one, change everything, end up somewhere strange.
      </p>

      {/* HTML page templates — the no-UI, drop-in-anywhere starters */}
      <Link
        href="/templates/html"
        className="card flex flex-wrap items-center justify-between gap-3 mb-10 hover:shadow-md transition-shadow"
      >
        <div>
          <div className="font-bold flex items-center gap-2">
            <span className="text-probe-500">✦</span> Looking for plain HTML pages?
          </div>
          <p className="text-sm text-probe-700 mt-1">
            Download a ready-made contact, newsletter, waitlist, or feedback page with a
            working form backend — add your access key and deploy anywhere.
          </p>
        </div>
        <span className="btn btn-ghost text-sm shrink-0">Browse HTML templates →</span>
      </Link>

      <h2 className="display text-2xl font-bold mb-4">Themes</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {themes.map((t) => (
          <div key={t.id} className="card flex flex-col hover:shadow-md transition-shadow">
            {/* Mini form preview: page background holding a surface card. `text`
                is designed to read on `surface`, not directly on `background`
                (which is dark for some themes, e.g. Windows Vista). */}
            <div
              className="rounded-[2px] p-5 mb-4"
              style={{
                background: t.config.background,
                fontFamily: t.config.fontFamily,
                border: `1px solid ${t.config.border}`,
              }}
            >
              <div
                className="rounded-[2px] p-4"
                style={{
                  background: t.config.surface,
                  color: t.config.text,
                  border: `1px solid ${t.config.border}`,
                }}
              >
                <div aria-hidden className="mb-2 h-3 w-3 rounded-full" style={{ background: t.config.accent }} />
                <div className="font-bold">{t.name}</div>
                <p className="text-xs mt-1" style={{ color: t.config.textMuted }}>
                  Aa — the quick brown fox
                </p>
                <button
                  style={{
                    background: t.config.accent,
                    color: t.config.accentText,
                    border: 0,
                    padding: "6px 12px",
                    borderRadius: 8,
                    marginTop: 12,
                  }}
                >
                  Sample button
                </button>
              </div>
            </div>
            <div className="text-xs text-probe-700 uppercase font-semibold tracking-wide">{t.category}</div>
            <div className="font-bold mt-1">{t.name}</div>
            <p className="text-sm text-probe-700 mt-1 flex-1">{t.description}</p>
            <Link
              href={`/dashboard/forms/new?theme=${t.id}`}
              className="btn btn-ghost text-sm mt-4 self-start"
            >
              Use this theme →
            </Link>
          </div>
        ))}
      </div>

      {themes.length === 0 && (
        <div className="card text-center text-probe-700">
          Themes couldn&apos;t load right now. Try refreshing in a moment.
        </div>
      )}
    </section>
  );
}
