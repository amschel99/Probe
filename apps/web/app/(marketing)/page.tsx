import type { RouterOutputs } from "@repo/trpc/client";
import Link from "next/link";

import { api } from "@/lib/trpc-server";

type Theme = RouterOutputs["themes"]["list"][number];

const TICKER = [
  "Hosted forms",
  "Form-to-email endpoints",
  "Signed webhooks",
  "Conditional logic",
  "Multi-page",
  "File uploads",
  "CSV · XLSX · PDF",
  "Discord",
  "Google Sheets",
  "API keys",
  "llms.txt",
  "Self-hosted",
];

const FIELD_TYPES = [
  "Short text",
  "Long text",
  "Email",
  "Number",
  "Phone",
  "URL",
  "Single select",
  "Multi select",
  "Checkbox",
  "Rating",
  "Linear scale",
  "Ranking",
  "Date",
  "Time",
  "Address",
  "Signature",
  "File upload",
  "Page break",
];

const SPECS: [string, string][] = [
  ["Runtime", "1 Docker image"],
  ["Database", "Postgres — yours"],
  ["Required config", "2 env vars"],
  ["Forms / responses", "Unlimited"],
  ["Third-party tracking", "None"],
  ["License", "MIT"],
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is it actually free?",
    a: "Yes. There are no plans and no feature gates. You run it on your own server, so the only bill is your hosting.",
  },
  {
    q: "Where does my data live?",
    a: "In your Postgres database, on your infrastructure. Respondent IPs are hashed before they're stored, and nothing is sent to an analytics vendor.",
  },
  {
    q: "What does it take to run?",
    a: "One container and a Postgres URL. Email (Resend), file storage (R2), rate limiting (Upstash) and Google Sheets are optional — leave them out and those features switch off quietly.",
  },
  {
    q: "Can my scripts or AI agents use it?",
    a: "That's half the point. Create an API key in Settings and anything that speaks HTTP can build forms, publish them and read responses. The full contract lives at /llms.txt.",
  },
  {
    q: "I already have a form on my site. Do I need to rebuild it?",
    a: "No. Create an endpoint form, point your existing <form> at /submit with its access key, and submissions land in Probe — with email alerts, webhooks and spam protection.",
  },
];

export default async function LandingPage() {
  let themes: Theme[] = [];
  try {
    themes = await api.themes.list.query();
  } catch {
    // DB not configured — render the static parts only.
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-probe-900 focus:px-4 focus:py-2 focus:text-probe-50"
      >
        Skip to main content
      </a>

      <div id="main-content" className="overflow-x-clip">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative">
          <HeroBackdrop />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28">
            <div>
              <p className="kicker anim-in flex items-center gap-2">
                <span className="relative inline-flex h-2 w-2">
                  <span className="anim-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-cyan)]" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-cyan)]" />
                </span>
                Probe — self-hosted forms
              </p>
              <h1
                className="chrome-text anim-in mt-5 text-[2.9rem] font-extrabold leading-[0.98] sm:text-6xl lg:text-[4.6rem]"
                style={{ animationDelay: "80ms" }}
              >
                Forms that
                <br />
                phone home.
              </h1>
              <p
                className="anim-in mt-6 max-w-xl text-lg leading-relaxed text-probe-700"
                style={{ animationDelay: "160ms" }}
              >
                Build a form, send it out, and every answer comes straight back to your own
                server. No plans, no per-response pricing, no one else holding your data.
              </p>
              <div
                className="anim-in mt-9 flex flex-col gap-3 sm:flex-row"
                style={{ animationDelay: "240ms" }}
              >
                <Link href="/register" className="btn btn-primary px-6 py-3 text-[15px]">
                  Start building <span aria-hidden>→</span>
                </Link>
                <Link href="/docs" className="btn btn-ghost px-6 py-3 text-[15px]">
                  Read the docs
                </Link>
              </div>
              <dl
                className="anim-in mt-10 grid max-w-md grid-cols-3 gap-4 font-mono text-xs"
                style={{ animationDelay: "320ms" }}
              >
                {[
                  ["∞", "forms"],
                  ["∞", "responses"],
                  ["0", "trackers"],
                ].map(([v, k]) => (
                  <div key={k} className="border-l border-probe-200 pl-3">
                    <dt className="sr-only">{k}</dt>
                    <dd className="font-display text-2xl font-bold text-probe-900">{v}</dd>
                    <dd className="mt-0.5 uppercase tracking-[0.14em] text-probe-700">{k}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <HeroCollage />
          </div>
        </section>

        {/* ── Ticker ───────────────────────────────────────────────────── */}
        <div className="border-y border-probe-200 bg-[var(--color-surface)]" aria-hidden>
          <div className="flex overflow-hidden py-3">
            <div className="anim-marquee flex shrink-0 gap-8 pr-8 font-mono text-xs uppercase tracking-[0.18em] text-probe-700">
              {[...TICKER, ...TICKER].map((t, i) => (
                <span key={i} className="flex items-center gap-8 whitespace-nowrap">
                  {t}
                  <span className="text-probe-500">✦</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── 01 Build ─────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
          <SectionHead
            n="01"
            label="Build"
            title="Everything the paid tiers lock away. Here, it's just on."
            body="Logic, multi-page flows, file uploads, exports and analytics come with every form. There's nothing to unlock."
          />

          <div className="mt-12 grid gap-4 md:grid-cols-6">
            <Win title="fields.lib" className="md:col-span-4">
              <p className="text-sm text-probe-700">18 field types, from one-liners to signatures.</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {FIELD_TYPES.map((f) => (
                  <li
                    key={f}
                    className="rounded border border-probe-200 bg-probe-50 px-2.5 py-1 font-mono text-[11px] text-probe-900"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            </Win>

            <Win title="logic.cfg" className="md:col-span-2">
              <div className="space-y-2 font-mono text-[12px] leading-relaxed">
                <p>
                  <span className="text-probe-500">if</span> plan{" "}
                  <span className="text-probe-700">equals</span> &quot;team&quot;
                </p>
                <p className="pl-4">
                  <span className="text-probe-500">show</span> team_size
                </p>
                <p>
                  <span className="text-probe-500">if</span> score{" "}
                  <span className="text-probe-700">&gt;</span> 8
                </p>
                <p className="pl-4">
                  <span className="text-probe-500">result</span> &quot;You&apos;re in&quot;
                </p>
              </div>
              <p className="mt-4 text-sm text-probe-700">
                Show and hide questions, split into pages, pipe answers into later questions, score
                outcomes.
              </p>
            </Win>

            <Win title="signal.exe" className="md:col-span-2">
              <Funnel />
              <p className="mt-4 text-sm text-probe-700">
                Views, starts, completions and the exact question where people drop off.
              </p>
            </Win>

            <Win title="export.bat" className="md:col-span-2">
              <div className="grid grid-cols-3 gap-2">
                {["CSV", "XLSX", "PDF"].map((x) => (
                  <div
                    key={x}
                    className="grid aspect-[3/4] place-items-center rounded border border-probe-200 bg-probe-50 font-display text-sm font-bold"
                  >
                    .{x.toLowerCase()}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-probe-700">
                Filter by date, download in one click, or stream every response to Sheets.
              </p>
            </Win>

            <Win title="shield.sys" className="md:col-span-2">
              <ul className="space-y-2 font-mono text-[12px]">
                {[
                  "password lock",
                  "captcha — hCaptcha · reCAPTCHA · Turnstile",
                  "honeypot",
                  "origin allowlist",
                  "rate limits",
                  "IPs hashed, never stored",
                ].map((s) => (
                  <li key={s} className="flex gap-2">
                    <span className="text-probe-500">▸</span>
                    {s}
                  </li>
                ))}
              </ul>
            </Win>
          </div>
        </section>

        {/* ── Themes (live data) ───────────────────────────────────────── */}
        {themes.length > 0 && (
          <section className="border-y border-probe-200 bg-[var(--color-surface)]">
            <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <SectionHead
                  n="✦"
                  label="Style"
                  title="Dress it up. Or don't."
                  body={`${themes.length} built-in themes, each with its own colours and type. Respondents see exactly what you pick.`}
                />
                <Link href="/templates" className="btn btn-ghost shrink-0 self-start md:self-auto">
                  Browse themes
                </Link>
              </div>
              <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {themes.map((t) => (
                  <li key={t.id}>
                    <div
                      className="group h-full overflow-hidden rounded-lg border transition-transform duration-200 hover:-translate-y-1 motion-reduce:transform-none"
                      style={{ borderColor: t.config.border, background: t.config.surface }}
                    >
                      <div className="h-14" style={{ background: t.config.background }}>
                        <div
                          className="ml-3 mt-3 h-1.5 w-10 rounded-full"
                          style={{ background: t.config.accent }}
                        />
                        <div
                          className="ml-3 mt-1.5 h-1.5 w-16 rounded-full opacity-40"
                          style={{ background: t.config.text }}
                        />
                      </div>
                      <div className="p-3" style={{ color: t.config.text, fontFamily: t.config.fontFamily }}>
                        <div className="text-sm font-bold leading-tight">{t.name}</div>
                        <div className="text-[11px]" style={{ color: t.config.textMuted }}>
                          {t.category}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ── 03 Collect ───────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
          <SectionHead
            n="02"
            label="Collect"
            title="Two ways in. One inbox."
            body="Share a hosted page, or keep the form you already have and just send it here."
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            <Win title="hosted — probe.riftfi.com/f/launch-waitlist">
              <h3 className="text-xl font-bold">Hosted forms</h3>
              <p className="mt-2 text-sm text-probe-700">
                A clean, fast page at its own link. Share it, embed it, or print the QR code.
                Password-protect it, cap responses, set a closing date.
              </p>
              <div className="mt-5 space-y-3 rounded-md border border-probe-200 bg-probe-50 p-4">
                <div className="h-2 w-24 rounded-full bg-probe-900/80" />
                <div className="h-9 rounded border border-probe-200 bg-[var(--color-surface)]" />
                <div className="h-9 rounded border border-probe-200 bg-[var(--color-surface)]" />
                <div className="h-8 w-24 rounded bg-probe-500" />
              </div>
            </Win>
            <Win title="endpoint — your-site.com/contact.html">
              <h3 className="text-xl font-bold">Endpoint forms</h3>
              <p className="mt-2 text-sm text-probe-700">
                Keep your own HTML. Post it to Probe and get email alerts, signed webhooks, spam
                filtering and a dashboard — no backend to write.
              </p>
              <pre className="mt-5 overflow-x-auto rounded-md bg-[#070A16] p-4 font-mono text-[12px] leading-relaxed text-[#C9D2F2]">
                <code>
                  <span className="text-[#6EF2FF]">&lt;form</span> action=
                  <span className="text-[#9FB0FF]">&quot;https://probe.riftfi.com/submit&quot;</span>{" "}
                  method=<span className="text-[#9FB0FF]">&quot;POST&quot;</span>
                  <span className="text-[#6EF2FF]">&gt;</span>
                  {"\n  "}
                  <span className="text-[#6EF2FF]">&lt;input</span> type=&quot;hidden&quot;
                  name=&quot;access_key&quot; value=&quot;…&quot;
                  <span className="text-[#6EF2FF]">&gt;</span>
                  {"\n  "}
                  <span className="text-[#6EF2FF]">&lt;input</span> name=&quot;email&quot;
                  <span className="text-[#6EF2FF]">&gt;</span>
                  {"\n  "}
                  <span className="text-[#6EF2FF]">&lt;button&gt;</span>Send
                  <span className="text-[#6EF2FF]">&lt;/button&gt;</span>
                  {"\n"}
                  <span className="text-[#6EF2FF]">&lt;/form&gt;</span>
                </code>
              </pre>
            </Win>
          </div>
        </section>

        {/* ── 04 Automate ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-[#04060D] text-[#E9EDFF]">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "radial-gradient(rgba(110,242,255,0.18) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(76,99,255,0.35), transparent 65%)" }}
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#6EF2FF]">
                03 — Automate
              </p>
              <h2 className="mt-4 text-4xl font-extrabold sm:text-5xl">
                Hand your agent a key.
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#9AA5C9]">
                It can build the form, publish it and read the replies without anyone touching
                the dashboard. Everything it needs to know is in one file.
              </p>
              <ul className="mt-8 grid gap-3 font-mono text-sm sm:grid-cols-2">
                {[
                  "Personal API keys",
                  "/llms.txt contract",
                  "Signed webhooks",
                  "Discord + Google Sheets",
                ].map((x) => (
                  <li key={x} className="flex items-center gap-2">
                    <span className="text-[#6EF2FF]">✦</span>
                    {x}
                  </li>
                ))}
              </ul>
              <a
                href="/llms.txt"
                className="mt-9 inline-flex items-center gap-2 font-mono text-sm text-[#6EF2FF] underline-offset-4 hover:underline"
              >
                read /llms.txt →
              </a>
            </div>

            <div className="overflow-hidden rounded-lg border border-[#1D2643] bg-[#070A16] shadow-[0_30px_80px_-30px_rgba(76,99,255,0.55)]">
              <div className="flex h-8 items-center gap-2 border-b border-[#1D2643] bg-gradient-to-b from-[#121931] to-[#0B1020] px-3 font-mono text-[11px] text-[#9AA5C9]">
                <span className="flex gap-1">
                  <span className="h-2.5 w-2.5 rounded-[2px] border border-[#1D2643]" />
                  <span className="h-2.5 w-2.5 rounded-[2px] border border-[#1D2643]" />
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-[#4C63FF]" />
                </span>
                agent@probe: ~
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-[1.7] text-[#C9D2F2]">
                <code>
                  <span className="text-[#6EF2FF]">$</span> curl -X POST probe.riftfi.com/trpc/forms.create \
                  {"\n    "}-H <span className="text-[#9FB0FF]">&quot;Authorization: Bearer probe_••••&quot;</span> \
                  {"\n    "}-d <span className="text-[#9FB0FF]">&apos;{"{"}&quot;json&quot;:{"{"}&quot;title&quot;:&quot;Beta signup&quot;,…{"}}"}&apos;</span>
                  {"\n"}
                  <span className="text-[#7C88B4]">{"{"} &quot;id&quot;: &quot;3f9c…&quot;, &quot;slug&quot;: &quot;beta-signup&quot; {"}"}</span>
                  {"\n\n"}
                  <span className="text-[#6EF2FF]">$</span> curl …/trpc/forms.publish
                  {"\n"}
                  <span className="text-[#7C88B4]">{"{"} &quot;status&quot;: &quot;published&quot; {"}"}</span>
                  {"\n\n"}
                  <span className="text-[#6EF2FF]">$</span> curl …/trpc/responses.list
                  {"\n"}
                  <span className="text-[#7C88B4]">{"{"} &quot;items&quot;: [ 12 responses ] {"}"}</span>
                  {"\n"}
                  <span className="text-[#6EF2FF]">$</span>{" "}
                  <span className="anim-blink inline-block h-4 w-2 translate-y-0.5 bg-[#6EF2FF]" />
                </code>
              </pre>
            </div>
          </div>
        </section>

        {/* ── 05 Own ───────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
            <SectionHead
              n="04"
              label="Own"
              title="One container. One Postgres. That's the stack."
              body="Deploy it on Railway, a VPS or your laptop. Your forms and every response live in a database you control — export it, back it up, query it directly."
            />
            <div className="window">
              <div className="window-bar">
                <span className="window-title">system.info</span>
                <span className="window-btns">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
              <dl className="divide-y divide-probe-200 font-mono text-sm">
                {SPECS.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 px-5 py-3">
                    <dt className="text-probe-700">{k}</dt>
                    <dd className="text-right font-medium text-probe-900">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className="border-t border-probe-200">
          <div className="mx-auto max-w-3xl px-5 py-24 sm:px-6">
            <p className="kicker">FAQ</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Questions, answered.</h2>
            <div className="mt-10 divide-y divide-probe-200 border-y border-probe-200">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-lg font-semibold [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span
                      aria-hidden
                      className="grid h-7 w-7 shrink-0 place-items-center rounded border border-probe-200 font-mono text-probe-500 transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl leading-relaxed text-probe-700">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────── */}
        <section className="px-5 pb-24 sm:px-6">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-xl border border-probe-200 bg-[var(--color-surface)] px-6 py-16 text-center sm:py-20">
            <Sparkles />
            <p className="kicker relative">Ready when you are</p>
            <h2 className="chrome-text relative mx-auto mt-4 max-w-3xl text-4xl font-extrabold sm:text-6xl">
              Send your first probe.
            </h2>
            <p className="relative mx-auto mt-5 max-w-md text-probe-700">
              It takes about a minute to make a form. The first account on a new install becomes
              the admin.
            </p>
            <div className="relative mt-9 flex justify-center">
              <Link href="/register" className="btn btn-primary px-7 py-3 text-[15px]">
                Create a form <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

/* ───────────────────────────────────────────────────────────────────────── */

function SectionHead({
  n,
  label,
  title,
  body,
}: {
  n: string;
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="kicker">
        {n} — {label}
      </p>
      <h2 className="mt-3 text-3xl font-bold sm:text-[2.6rem]">{title}</h2>
      <p className="mt-4 text-lg leading-relaxed text-probe-700">{body}</p>
    </div>
  );
}

function Win({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`window ${className}`}>
      <div className="window-bar">
        <span className="window-title">{title}</span>
        <span className="window-btns" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Funnel() {
  const rows: [string, number][] = [
    ["views", 100],
    ["starts", 72],
    ["done", 58],
  ];
  return (
    <div className="space-y-2.5 font-mono text-[11px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center gap-3">
          <span className="w-12 uppercase tracking-wider text-probe-700">{k}</span>
          <span className="h-3 flex-1 overflow-hidden rounded-sm bg-probe-100">
            <span
              className="block h-full rounded-sm"
              style={{
                width: `${v}%`,
                background:
                  "linear-gradient(90deg, var(--color-probe-500), var(--color-cyan))",
              }}
            />
          </span>
          <span className="w-8 text-right text-probe-900">{v}%</span>
        </div>
      ))}
    </div>
  );
}

function Sparkles() {
  const stars: { top: string; left: string; size: number; delay: string }[] = [
    { top: "14%", left: "8%", size: 16, delay: "0s" },
    { top: "70%", left: "14%", size: 10, delay: "1.2s" },
    { top: "22%", left: "88%", size: 14, delay: "0.6s" },
    { top: "76%", left: "84%", size: 18, delay: "1.8s" },
    { top: "48%", left: "94%", size: 8, delay: "2.4s" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {stars.map((s, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="anim-twinkle absolute text-probe-500"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: s.delay }}
        >
          <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" fill="currentColor" />
        </svg>
      ))}
    </div>
  );
}

function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute -top-48 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--color-probe-500) 28%, transparent), transparent 62%)",
        }}
      />
      <Sparkles />
    </div>
  );
}

/** Overlapping early-OS windows: one readable form, with the inbox and a
 *  live readout stacked behind it. Decorative — the real thing is one click away. */
function HeroCollage() {
  return (
    <div className="relative mx-auto w-full max-w-[34rem] lg:h-[34rem]" aria-hidden>
      {/* Orbiting planet */}
      <svg
        viewBox="0 0 200 200"
        className="anim-float absolute -right-6 -top-10 hidden h-36 w-36 sm:block"
        style={{ animationDelay: "1s" }}
      >
        <defs>
          <radialGradient id="planet" cx="35%" cy="30%" r="70%">
            <stop offset="0" stopColor="#B9C4FF" />
            <stop offset="0.45" stopColor="#4C63FF" />
            <stop offset="1" stopColor="#0B1460" />
          </radialGradient>
        </defs>
        <ellipse cx="100" cy="104" rx="92" ry="22" fill="none" stroke="var(--color-cyan)" strokeOpacity="0.55" strokeWidth="2" />
        <circle cx="100" cy="100" r="48" fill="url(#planet)" />
        <path d="M8 104 A92 22 0 0 0 192 104" fill="none" stroke="var(--color-cyan)" strokeWidth="2.5" />
      </svg>

      {/* Back: inbox log */}
      <div className="window absolute left-0 top-0 hidden w-[20rem] -rotate-2 lg:block">
        <div className="window-bar">
          <span className="window-title">inbox.log</span>
          <span className="window-btns">
            <span />
            <span />
            <span />
          </span>
        </div>
        <ul className="space-y-1.5 p-4 font-mono text-[11px] text-probe-700">
          {[
            ["09:41:02", "ada@lovelace.dev"],
            ["09:41:17", "grace@hopper.io"],
            ["09:42:55", "alan@turing.uk"],
            ["09:44:30", "kat@johnson.space"],
          ].map(([t, e]) => (
            <li key={t} className="flex justify-between gap-3">
              <span className="text-probe-500">{t}</span>
              <span className="truncate">{e}</span>
            </li>
          ))}
          <li className="text-probe-900">
            ▸ listening<span className="anim-blink">_</span>
          </li>
        </ul>
      </div>

      {/* Back: readout */}
      <div className="window absolute bottom-0 left-2 hidden w-56 -rotate-3 lg:block">
        <div className="window-bar">
          <span className="window-title">signal.exe</span>
          <span className="window-btns">
            <span />
            <span />
            <span />
          </span>
        </div>
        <div className="flex h-24 items-end gap-1.5 p-4">
          {[30, 52, 41, 68, 59, 84, 72, 96].map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-t-sm"
              style={{
                height: `${h}%`,
                background: "linear-gradient(180deg, var(--color-cyan), var(--color-probe-500))",
              }}
            />
          ))}
        </div>
      </div>

      {/* Front: the form */}
      <div className="window anim-float relative z-10 mx-auto w-full max-w-sm lg:absolute lg:right-0 lg:top-24">
        <div className="window-bar">
          <span className="window-title">launch-waitlist.form</span>
          <span className="window-btns">
            <span />
            <span />
            <span />
          </span>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <div className="font-display text-xl font-bold">Join the launch list</div>
            <div className="mt-1 text-sm text-probe-700">We&apos;ll write once. Promise.</div>
          </div>
          {[
            ["Name", "Ada Lovelace"],
            ["Email", "ada@lovelace.dev"],
          ].map(([l, v]) => (
            <div key={l}>
              <div className="mb-1.5 text-xs font-semibold">{l}</div>
              <div className="rounded-md border border-probe-200 bg-probe-50 px-3 py-2 text-sm">{v}</div>
            </div>
          ))}
          <div>
            <div className="mb-1.5 text-xs font-semibold">What are you building?</div>
            <div className="rounded-md border border-probe-500 bg-probe-50 px-3 py-2 text-sm shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-probe-500)_20%,transparent)]">
              An analytical engine
              <span className="anim-blink ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-probe-900" />
            </div>
          </div>
          <div className="btn btn-primary w-full">Submit</div>
        </div>
      </div>
    </div>
  );
}
