import type { RouterOutputs } from "@repo/trpc/client";
import Link from "next/link";

import { api } from "@/lib/trpc-server";

type Theme = RouterOutputs["themes"]["list"][number];

const WHAT: [string, string][] = [
  ["Hosted forms", "A clean page at its own link. Share it, embed it, or print the QR code."],
  ["Endpoint forms", "Keep the HTML you already have. Point it at Probe and the submissions arrive."],
  ["Logic", "Show or skip questions, split long forms into pages, score answers."],
  ["Reports", "Views, starts, completions, and the question where people stop."],
  ["Delivery", "Email alerts, signed webhooks, Discord, Google Sheets. CSV, Excel, PDF."],
  ["Agents", "API keys and a plain-text contract, so software can do the clicking."],
];

const FIELDS = [
  "Short text", "Long text", "Email", "Number", "Phone", "URL", "Single select",
  "Multi select", "Checkbox", "Rating", "Linear scale", "Ranking", "Date", "Time",
  "Address", "Signature", "File upload", "Page break",
];

const SPECS: [string, string][] = [
  ["Runtime", "One Docker image"],
  ["Database", "Postgres, yours"],
  ["Required settings", "Two"],
  ["Forms and responses", "Unlimited"],
  ["Third-party tracking", "None"],
  ["Licence", "MIT"],
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is it free?",
    a: "Yes. There are no plans and nothing is held back. You run it on your own server, so the only cost is the server.",
  },
  {
    q: "Where does the data go?",
    a: "Into your Postgres database and nowhere else. Respondent IP addresses are hashed before they are stored. No analytics vendor sees anything.",
  },
  {
    q: "What does it need to run?",
    a: "A container and a Postgres connection string. Email, file storage, rate limiting and Google Sheets are optional; leave them out and those features stay off.",
  },
  {
    q: "Can software use it without the dashboard?",
    a: "Yes. Create an API key in Settings. Anything that can make an HTTP request can build forms, publish them and read responses. The contract is at /llms.txt.",
  },
  {
    q: "I already have a form on my website.",
    a: "Create an endpoint form and set your form's action to /submit with its access key. Submissions land in Probe with email alerts, webhooks and spam filtering.",
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
      {/* Halftone-filled type: dots instead of solid ink. */}
      <style>{`
        .ht-text {
          background-image: radial-gradient(var(--ht, #0B0B0C) 44%, transparent 46%);
          background-size: 4px 4px;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
      `}</style>

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-probe-900 focus:px-4 focus:py-2 focus:text-probe-50"
      >
        Skip to main content
      </a>

      <div id="main-content" className="overflow-x-clip">
        {/* ── Hero: collage ────────────────────────────────────────────── */}
        <section className="relative border-b border-probe-200 bg-[var(--color-surface)]">
          {/* print grain */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: "radial-gradient(#0B0B0C 30%, transparent 32%)",
              backgroundSize: "4px 4px",
            }}
          />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-5 pb-20 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.15fr_1fr] lg:gap-4">
            <div className="relative z-10">
              <p className="kicker anim-in">Self-hosted forms</p>
              <h1
                className="anim-in mt-6 text-[3.4rem] leading-[0.92] sm:text-[5.2rem] lg:text-[6.4rem]"
                style={{ animationDelay: "60ms" }}
              >
                <span className="block">
                  Ask{" "}
                  <span
                    className="pixel ht-text align-[0.08em] text-[0.66em] font-bold"
                    style={{ ["--ht" as string]: "var(--color-probe-900)" }}
                  >
                    the
                  </span>
                </span>
                <span className="block">
                  questi
                  <OrbitO />n.
                </span>
                <span className="mt-2 block">
                  <span className="pixel text-[0.66em] font-bold text-probe-500">Keep</span>{" "}
                  the answers.
                </span>
              </h1>

              <div
                className="anim-in mt-8 max-w-md space-y-3 font-display text-xl text-probe-900 sm:text-2xl"
                style={{ animationDelay: "160ms" }}
              >
                <p>
                  <Bouncy text="is it required?" />
                </p>
                <p className="pl-10">or optional?</p>
                <p className="pl-4">
                  welcome to your <em>own</em> database.
                </p>
              </div>

              <p
                className="anim-in mt-8 max-w-lg text-[17px] font-light leading-relaxed text-[var(--color-body)]"
                style={{ animationDelay: "220ms" }}
              >
                Probe is a form builder you run yourself. Every response goes to your server, and
                there&apos;s no limit on how many you collect.
              </p>
              <div
                className="anim-in mt-8 flex flex-col gap-3 sm:flex-row"
                style={{ animationDelay: "280ms" }}
              >
                <Link href="/register" className="btn btn-primary px-6 py-3.5">
                  Create a form
                </Link>
                <Link href="/docs" className="btn btn-ghost px-6 py-3.5">
                  Read the docs
                </Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[30rem] lg:mt-10" aria-hidden>
              <RetroComputer />
              <div className="win anim-pop absolute -left-2 top-4 w-[15.5rem] sm:-left-10" style={{ animationDelay: "900ms" }}>
                <div className="win-title">
                  <span>New Response</span>
                  <span className="win-x">×</span>
                </div>
                <div className="win-body flex gap-3">
                  <PixelEnvelope />
                  <div>
                    <div>1 new submission</div>
                    <div className="mt-0.5 text-[12px] text-[#4A4A4A]">Site visit request</div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 px-3 pb-3">
                  <span className="win-btn">Open</span>
                  <span className="win-btn">Later</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it travels ───────────────────────────────────────────── */}
        <section className="border-b border-probe-200 bg-probe-100">
          <div className="mx-auto max-w-6xl px-5 pt-20 sm:px-6">
            <p className="kicker">How it travels</p>
            <h2 className="mt-5 max-w-3xl text-4xl sm:text-5xl">
              Forms, pages and agents send answers in. Your server keeps them.
            </h2>
          </div>
          <div className="mt-8 overflow-hidden" aria-hidden>
            <SignalDiagram />
          </div>
        </section>

        {/* ── What it does ─────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-24 sm:px-6 md:py-32">
          <div className="grid gap-12 md:grid-cols-[1fr_1.5fr] md:gap-16">
            <div>
              <p className="kicker">What it does</p>
              <h2 className="mt-5 text-4xl sm:text-5xl">
                A form builder, a form backend, and an{" "}
                <span className="pixel text-[0.8em] text-probe-500">API</span>.
              </h2>
            </div>
            <div className="border-t border-probe-900">
              {WHAT.map(([term, desc], i) => (
                <div
                  key={term}
                  className="grid gap-1 border-b border-probe-200 py-6 sm:grid-cols-[2.5rem_11.5rem_1fr] sm:items-baseline sm:gap-6"
                >
                  <div className="pixel text-xs text-probe-500">{String(i + 1).padStart(2, "0")}</div>
                  <div className="font-display text-[1.8rem] leading-none">{term}</div>
                  <p className="font-light leading-relaxed text-[var(--color-body)]">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Builder ──────────────────────────────────────────────────── */}
        <section className="border-y border-probe-200 bg-probe-100">
          <div className="mx-auto grid max-w-6xl gap-14 px-5 py-24 sm:px-6 md:grid-cols-2 md:items-center md:py-32">
            <FormSpecimen />
            <div>
              <p className="kicker">The builder</p>
              <h2 className="mt-5 text-4xl sm:text-5xl">
                Eighteen kinds of question. Logic when you need it.
              </h2>
              <p className="mt-6 max-w-lg font-light leading-relaxed text-[var(--color-body)]">
                Drag questions into place, set what&apos;s required, and decide what shows
                when. Lock a form with a password, cap the number of responses, or close it on
                a date.
              </p>
              <p className="mt-8 font-mono text-[12px] leading-[2] text-probe-700">
                {FIELDS.map((f, i) => (
                  <span key={f}>
                    <span className="whitespace-nowrap">{f}</span>
                    {i < FIELDS.length - 1 && <span className="px-2 text-probe-500">/</span>}{" "}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </section>

        {/* ── Themes (live data) ───────────────────────────────────────── */}
        {themes.length > 0 && (
          <section className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="kicker">Themes</p>
                <h2 className="mt-5 text-4xl sm:text-5xl">Make it look like yours.</h2>
              </div>
              <Link href="/templates" className="btn btn-ghost self-start md:self-auto">
                All {themes.length} themes
              </Link>
            </div>
            <ul className="mt-12 grid grid-cols-2 border-l border-t border-probe-200 sm:grid-cols-3 lg:grid-cols-5">
              {themes.map((t) => (
                <li key={t.id} className="border-b border-r border-probe-200 p-4">
                  <div
                    className="aspect-[4/3] border p-3"
                    style={{ background: t.config.surface, borderColor: t.config.border }}
                  >
                    <div className="h-1.5 w-2/3" style={{ background: t.config.text, opacity: 0.85 }} />
                    <div className="mt-3 h-4 border" style={{ borderColor: t.config.border }} />
                    <div className="mt-2 h-4 border" style={{ borderColor: t.config.border }} />
                    <div className="mt-3 h-3 w-10" style={{ background: t.config.accent }} />
                  </div>
                  <div className="mt-3 text-sm font-medium">{t.name}</div>
                  <div className="font-mono text-[11px] text-probe-700">{t.category}</div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Agents ───────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-[#0B0B0C] text-[#F2F2EE]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{ backgroundImage: "radial-gradient(#5C74FF 30%, transparent 32%)", backgroundSize: "6px 6px" }}
          />
          <div className="relative mx-auto grid max-w-6xl gap-14 px-5 py-24 sm:px-6 md:grid-cols-2 md:items-center md:py-32">
            <div>
              <p className="pixel text-[12px] uppercase tracking-[0.06em] text-[#7D93FF]">For agents</p>
              <h2 className="mt-5 text-4xl sm:text-5xl">
                Give your agent a <span className="pixel text-[0.82em] text-[#7D93FF]">key</span>. It
                does the rest.
              </h2>
              <p className="mt-6 max-w-md font-light leading-relaxed text-[#C8CAD0]">
                An API key lets a script or an AI agent build a form, publish it and read what
                comes back, without anyone opening the dashboard. Everything it needs to know is
                in one plain-text file.
              </p>
              <a
                href="/llms.txt"
                className="mt-8 inline-block border-b border-[#7D93FF] pb-0.5 font-mono text-sm text-[#F2F2EE] hover:text-[#7D93FF]"
              >
                probe.riftfi.com/llms.txt
              </a>
            </div>
            <div className="win">
              <div className="win-title">
                <span>C:\PROBE\agent.bat</span>
                <span className="win-x">×</span>
              </div>
              <pre className="m-[3px] overflow-x-auto bg-black p-5 font-mono text-[12.5px] leading-[1.75] text-[#C0C0C0]">
                <code>
                  <span className="text-[#7D93FF]">REM create a form</span>
                  {"\n"}curl -X POST https://probe.riftfi.com/trpc/forms.create \
                  {"\n"}  -H &quot;Authorization: Bearer probe_…&quot; \
                  {"\n"}  -d &apos;{"{"}&quot;json&quot;:{"{"}&quot;title&quot;:&quot;Field survey&quot;{"}}"}&apos;
                  {"\n\n"}
                  <span className="text-[#7D93FF]">REM publish it</span>
                  {"\n"}curl -X POST …/trpc/forms.publish
                  {"\n\n"}
                  <span className="text-[#7D93FF]">REM read the answers</span>
                  {"\n"}curl …/trpc/responses.list
                  {"\n"}C:\PROBE&gt;
                  <span className="anim-blink ml-1 inline-block h-[1em] w-[0.6em] translate-y-[0.15em] bg-[#C0C0C0]" />
                </code>
              </pre>
            </div>
          </div>
        </section>

        {/* ── Running it ───────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-24 sm:px-6 md:py-32">
          <div className="grid gap-12 md:grid-cols-[1fr_1.5fr] md:gap-16">
            <div>
              <p className="kicker">Running it</p>
              <h2 className="mt-5 text-4xl sm:text-5xl">One container. One database.</h2>
              <p className="mt-6 font-light leading-relaxed text-[var(--color-body)]">
                Put it on Railway, a small VPS or the computer under your desk. Back it up,
                query it, move it. It is your database.
              </p>
            </div>
            <table className="w-full self-start text-left">
              <thead>
                <tr className="border-b border-probe-900">
                  <th className="pb-3 font-mono text-[11px] font-normal uppercase tracking-[0.18em] text-probe-700">
                    Item
                  </th>
                  <th className="pb-3 text-right font-mono text-[11px] font-normal uppercase tracking-[0.18em] text-probe-700">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {SPECS.map(([k, v]) => (
                  <tr key={k} className="border-b border-probe-200">
                    <td className="py-4 font-light text-[var(--color-body)]">{k}</td>
                    <td className="py-4 text-right font-display text-2xl">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Questions ────────────────────────────────────────────────── */}
        <section className="border-t border-probe-200 bg-probe-100">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:px-6 md:grid-cols-[1fr_1.5fr] md:gap-16 md:py-32">
            <div>
              <p className="kicker">Questions</p>
              <h2 className="mt-5 text-4xl sm:text-5xl">Before you start.</h2>
            </div>
            <div className="border-t border-probe-900">
              {FAQ.map((f) => (
                <details key={f.q} className="group border-b border-probe-200">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-left [&::-webkit-details-marker]:hidden">
                    <span className="font-display text-2xl leading-tight">{f.q}</span>
                    <span
                      aria-hidden
                      className="pixel text-lg text-probe-500 transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="max-w-xl pb-6 pr-8 font-light leading-relaxed text-[var(--color-body)]">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Close ────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-5 py-24 text-center sm:px-6 md:py-32">
          <h2 className="text-5xl sm:text-7xl">
            Start <span className="pixel text-[0.8em] font-bold text-probe-500">collecting</span>.
          </h2>
          <p className="mx-auto mt-6 max-w-md font-light text-[var(--color-body)]">
            Making a form takes about a minute. On a new install, the first account becomes the
            admin.
          </p>
          <div className="mt-10 flex justify-center">
            <Link href="/register" className="btn btn-primary px-7 py-3.5">
              Create a form
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

/* ───────────────────────────────────────────────────────────────────────── */

/** The "o" in "question": the Probe orbit mark, sized to the letter. */
function OrbitO() {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden
      className="mx-[0.02em] inline-block h-[0.62em] w-[0.62em] align-baseline"
      fill="none"
    >
      <circle cx="24" cy="26" r="13" fill="var(--color-probe-500)" />
      <circle cx="24" cy="26" r="13" fill="url(#orbit-ht)" opacity="0.35" />
      <defs>
        <pattern id="orbit-ht" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#fff" />
        </pattern>
      </defs>
      <ellipse cx="24" cy="26" rx="23" ry="8" transform="rotate(-18 24 26)" stroke="currentColor" strokeWidth="2.6" />
    </svg>
  );
}

/** Letters on a wobbly baseline, like they were cut out and pasted. */
function Bouncy({ text }: { text: string }) {
  const offsets = [0, -6, 3, -10, 2, -4, 6, -8, 0, 4, -6, 2, -3, 5, -7, 1];
  return (
    <span aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <span
          key={i}
          aria-hidden
          className="inline-block"
          style={{ transform: `translateY(${offsets[i % offsets.length]}px)` }}
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}

function PixelEnvelope() {
  // 12×10 pixel envelope, drawn cell by cell.
  const rows = [
    "111111111111",
    "120000000021",
    "102000000201",
    "100200002001",
    "100022220001",
    "100000000001",
    "100000000001",
    "100000000001",
    "111111111111",
  ];
  return (
    <svg viewBox="0 0 12 9" className="h-7 w-9 shrink-0" shapeRendering="crispEdges">
      {rows.flatMap((r, y) =>
        Array.from(r).map((c, x) =>
          c === "0" ? null : (
            <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={c === "1" ? "#0B0B0C" : "#1A3BFF"} />
          ),
        ),
      )}
      <rect x="1" y="5" width="10" height="3" fill="#FFF7C2" opacity="0.9" />
    </svg>
  );
}

/** Beige CRT with a form on screen, halftone-shaded, in a blue dither spray. */
function RetroComputer() {
  // Deterministic dither spray around the base.
  const spray: { x: number; y: number; s: number; o: number }[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 520; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd());
    const x = 230 + Math.cos(a) * r * 235;
    const y = 400 + Math.sin(a) * r * 70;
    spray.push({ x, y, s: rnd() < 0.3 ? 4 : 3, o: 1 - r * 0.85 });
  }

  const beige = "#E7E1D1";
  const beige2 = "#D8D0BC";
  const ink = "#0B0B0C";

  return (
    <svg viewBox="0 0 460 470" className="block h-auto w-full" fill="none">
      <defs>
        <pattern id="crt-dots" width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="1.1" fill={ink} />
        </pattern>
        <pattern id="crt-scan" width="4" height="3" patternUnits="userSpaceOnUse">
          <rect width="4" height="1" fill="#FFFFFF" opacity="0.12" />
        </pattern>
        <pattern id="crt-keys" width="18" height="12" patternUnits="userSpaceOnUse">
          <rect x="1" y="1" width="15" height="9" fill="#EFEADC" stroke={ink} strokeOpacity="0.35" strokeWidth="0.8" />
        </pattern>
        <linearGradient id="crt-bar" x1="0" x2="1">
          <stop offset="0" stopColor="#08158F" />
          <stop offset="1" stopColor="#4E9BFF" />
        </linearGradient>
        <clipPath id="crt-body">
          <rect x="55" y="20" width="350" height="268" rx="16" />
        </clipPath>
      </defs>

      {/* spray */}
      <g fill="#1A3BFF">
        {spray.map((p, i) => (
          <rect key={i} x={p.x.toFixed(1)} y={p.y.toFixed(1)} width={p.s} height={p.s} opacity={p.o.toFixed(2)} />
        ))}
      </g>

      {/* monitor */}
      <rect x="55" y="20" width="350" height="268" rx="16" fill={beige} stroke={ink} strokeWidth="1.6" />
      <rect x="55" y="20" width="350" height="268" fill="url(#crt-dots)" opacity="0.13" clipPath="url(#crt-body)" style={{ mixBlendMode: "multiply" }} />
      <rect x="78" y="40" width="304" height="212" rx="8" fill={beige2} stroke={ink} strokeWidth="1.2" />
      <rect x="92" y="52" width="276" height="188" rx="6" fill="#0E1C7A" stroke={ink} strokeWidth="1.2" />

      {/* on-screen form window */}
      <g>
        <rect x="112" y="68" width="236" height="156" fill="#ECEEF6" stroke={ink} strokeWidth="1" />
        <rect x="113" y="69" width="234" height="13" fill="url(#crt-bar)" />
        <rect x="118" y="73" width="70" height="4" fill="#FFFFFF" opacity="0.9" />
        <rect x="124" y="94" width="110" height="7" fill={ink} opacity="0.85" />
        <rect x="124" y="106" width="150" height="3" fill={ink} opacity="0.35" />
        <rect x="124" y="120" width="40" height="3" fill={ink} opacity="0.6" />
        <rect x="124" y="126" width="210" height="14" fill="#FFFFFF" stroke={ink} strokeOpacity="0.5" />
        <rect x="124" y="148" width="50" height="3" fill={ink} opacity="0.6" />
        <rect x="124" y="154" width="210" height="14" fill="#FFFFFF" stroke="#1A3BFF" strokeWidth="1.4" />
        <rect x="128" y="158" width="64" height="6" fill={ink} opacity="0.55" />
        <rect x="194" y="157" width="1.5" height="8" fill={ink} className="anim-blink" />
        <rect x="124" y="180" width="62" height="16" fill="#1A3BFF" stroke={ink} strokeWidth="0.8" />
        <rect x="136" y="186" width="38" height="4" fill="#FFFFFF" />
      </g>
      <rect x="92" y="52" width="276" height="188" rx="6" fill="url(#crt-scan)" />
      <path d="M100 60 Q 230 48 360 60 L 360 92 Q 230 78 100 92 Z" fill="#FFFFFF" opacity="0.07" />

      {/* badge + led */}
      <rect x="96" y="262" width="40" height="7" fill={beige2} stroke={ink} strokeWidth="0.8" />
      <circle cx="360" cy="266" r="3.2" fill="#1A3BFF" className="anim-pulse" />

      {/* neck */}
      <path d="M190 288 L 270 288 L 284 312 L 176 312 Z" fill={beige2} stroke={ink} strokeWidth="1.4" />

      {/* case */}
      <rect x="40" y="312" width="380" height="58" rx="5" fill={beige} stroke={ink} strokeWidth="1.6" />
      <rect x="40" y="312" width="380" height="58" fill="url(#crt-dots)" opacity="0.1" />
      <rect x="70" y="328" width="120" height="8" fill={beige2} stroke={ink} strokeWidth="1" />
      <rect x="70" y="344" width="120" height="8" fill={beige2} stroke={ink} strokeWidth="1" />
      <rect x="300" y="332" width="90" height="4" fill={ink} opacity="0.5" />
      <rect x="300" y="340" width="90" height="4" fill={ink} opacity="0.5" />
      <rect x="300" y="348" width="90" height="4" fill={ink} opacity="0.5" />

      {/* keyboard */}
      <path d="M30 388 L 430 388 L 412 452 L 48 452 Z" fill={beige} stroke={ink} strokeWidth="1.6" />
      <path d="M52 396 L 408 396 L 394 444 L 66 444 Z" fill="url(#crt-keys)" />
    </svg>
  );
}

/** A plain, believable form inside a Win98 window. */
function FormSpecimen() {
  return (
    <div className="win" aria-hidden>
      <div className="win-title">
        <span>Site visit request — Probe</span>
        <span className="win-x">×</span>
      </div>
      <div className="m-[3px] bg-white p-7 text-[#0B0B0C] sm:p-9">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#56585C]">
          probe.riftfi.com/f/site-visit
        </div>
        <div className="mt-5 font-display text-[2rem] leading-tight">Site visit request</div>
        <p className="mt-2 text-sm font-light text-[#34363A]">
          Tell us where and when. We reply within a day.
        </p>
        <div className="mt-7 space-y-5">
          <Field label="Company" value="Kilima Solar Ltd" />
          <Field label="Location" value="Naivasha, Nakuru County" />
          <div>
            <div className="mb-2 text-sm font-medium">Preferred week</div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              {["12 May", "19 May", "26 May"].map((w, i) => (
                <div
                  key={w}
                  className={`border px-3 py-2 text-center ${
                    i === 1 ? "border-[#0B0B0C] bg-[#1A3BFF] text-white" : "border-[#BDBDB4]"
                  }`}
                >
                  {w}
                </div>
              ))}
            </div>
          </div>
          <div className="btn btn-primary w-full">Send request</div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium">{label}</div>
      <div className="border border-[#BDBDB4] bg-white px-3 py-2.5 text-sm">{value}</div>
    </div>
  );
}

/**
 * Line-art map of a Probe install: forms, pages and agents orbit your server;
 * blue signals travel in, a webhook travels out. Pure SVG + SMIL, no images.
 */
function SignalDiagram() {
  const ink = "var(--color-probe-900)";
  const blue = "var(--color-signal)";
  const paper = "var(--color-probe-100)";
  const nodes: { x: number; y: number; label: string; sub: string; anchor: "start" | "end"; path: string; out?: boolean }[] = [
    { x: 190, y: 352, label: "form", sub: "launch-waitlist", anchor: "end", path: "M190 352 Q 360 210 600 150" },
    { x: 330, y: 168, label: "html", sub: "contact.html → /submit", anchor: "end", path: "M330 168 Q 470 110 600 150" },
    { x: 870, y: 168, label: "webhook", sub: "api.yoursite.com", anchor: "start", path: "M600 150 Q 730 110 870 168", out: true },
    { x: 1010, y: 352, label: "agent", sub: "Bearer probe_••••", anchor: "start", path: "M1010 352 Q 840 210 600 150" },
  ];

  return (
    <svg
      viewBox="0 0 1200 520"
      className="relative left-1/2 block w-[max(100%,820px)] max-w-[1200px] -translate-x-1/2"
      fill="none"
    >
      <defs>
        <pattern id="sun-ht" width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="3.5" cy="3.5" r="2.2" fill={blue} />
        </pattern>
      </defs>

      {/* dome */}
      <path d="M120 500 A 480 480 0 0 1 1080 500" stroke={ink} strokeOpacity="0.35" strokeWidth="1" />
      <path d="M220 500 A 380 380 0 0 1 980 500" stroke={ink} strokeOpacity="0.18" strokeWidth="1" strokeDasharray="2 6" />

      {/* ground plane */}
      <ellipse cx="600" cy="500" rx="540" ry="64" stroke={ink} strokeOpacity="0.3" />
      <ellipse cx="600" cy="500" rx="380" ry="44" stroke={ink} strokeOpacity="0.22" strokeDasharray="3 5" />
      <ellipse cx="600" cy="500" rx="210" ry="24" stroke={ink} strokeOpacity="0.3" />
      {[-420, -280, -140, 0, 140, 280, 420].map((dx) => (
        <line key={dx} x1={600 + dx * 0.5} y1="476" x2={600 + dx * 1.25} y2="560" stroke={ink} strokeOpacity="0.12" />
      ))}

      {/* halftone sun */}
      <circle cx="600" cy="330" r="96" fill="url(#sun-ht)" />

      {/* the server: a drawn database stack */}
      <g>
        <path d="M548 250 V 478 A 52 14 0 0 0 652 478 V 250" fill={paper} stroke={ink} strokeWidth="1.4" />
        <ellipse cx="600" cy="250" rx="52" ry="14" fill={paper} stroke={ink} strokeWidth="1.4" />
        {[318, 386, 454].map((y) => (
          <path key={y} d={`M548 ${y} A 52 14 0 0 0 652 ${y}`} stroke={ink} strokeWidth="1" />
        ))}
        {[284, 352, 420].map((y) => (
          <g key={y}>
            <rect x="563" y={y - 3} width="6" height="6" fill={y === 284 ? blue : ink} className="anim-pulse" />
            <line x1="578" y1={y} x2="630" y2={y} stroke={ink} strokeOpacity="0.35" />
          </g>
        ))}
        {/* antenna */}
        <line x1="600" y1="236" x2="600" y2="156" stroke={ink} strokeWidth="1.4" />
        <rect x="594" y="144" width="12" height="12" fill={blue} stroke={ink} />
        <circle cx="600" cy="150" r="20" stroke={ink} strokeOpacity="0.4" strokeDasharray="2 4" className="anim-spin-slow" />
        <circle cx="600" cy="150" r="34" stroke={ink} strokeOpacity="0.2" />
        <text x="616" y="214" fontFamily="var(--font-pixel)" fontSize="12" fill={ink} fillOpacity="0.75">
          YOUR SERVER
        </text>
      </g>

      {/* links + travelling signals */}
      {nodes.map((n, i) => (
        <g key={n.label}>
          <path id={`sig-${i}`} d={n.path} stroke={ink} strokeOpacity="0.5" strokeDasharray="3 5" />
          <rect x="-4" y="-4" width="8" height="8" fill={blue} stroke={ink} strokeWidth="1">
            <animateMotion dur={`${4.2 + i * 0.7}s`} begin={`-${i * 0.9}s`} repeatCount="indefinite">
              <mpath href={`#sig-${i}`} />
            </animateMotion>
          </rect>
          <circle cx={n.x} cy={n.y} r="9" fill={paper} stroke={ink} strokeWidth="1.4" />
          <circle cx={n.x} cy={n.y} r="3" fill={n.out ? blue : ink} />
          <text
            x={n.anchor === "end" ? n.x - 18 : n.x + 18}
            y={n.y - 4}
            textAnchor={n.anchor}
            fontFamily="var(--font-display)"
            fontSize="28"
            fill={ink}
          >
            {n.label}
          </text>
          <text
            x={n.anchor === "end" ? n.x - 18 : n.x + 18}
            y={n.y + 16}
            textAnchor={n.anchor}
            fontFamily="var(--font-mono)"
            fontSize="11"
            fill={ink}
            fillOpacity="0.6"
          >
            {n.sub}
          </text>
        </g>
      ))}

      {/* survey marks */}
      <g fontFamily="var(--font-mono)" fontSize="10" fill={ink} fillOpacity="0.5" letterSpacing="1">
        <text x="40" y="40">01°17′S 36°49′E</text>
        <text x="1160" y="40" textAnchor="end">200 OK · 42 ms</text>
      </g>
      {[
        [96, 220],
        [1104, 220],
        [440, 60],
        [760, 60],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`} stroke={ink} strokeOpacity="0.45">
          <line x1={x - 6} y1={y} x2={x + 6} y2={y} />
          <line x1={x} y1={y - 6} x2={x} y2={y + 6} />
        </g>
      ))}
    </svg>
  );
}
