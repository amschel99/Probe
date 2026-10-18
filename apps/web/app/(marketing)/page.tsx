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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-probe-900 focus:px-4 focus:py-2 focus:text-probe-50"
      >
        Skip to main content
      </a>

      <div id="main-content" className="overflow-x-clip">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section
          className="relative border-b border-probe-200 bg-probe-100"
          style={{
            backgroundImage:
              "linear-gradient(color-mix(in srgb, var(--color-probe-900) 5%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--color-probe-900) 5%, transparent) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            backgroundPosition: "center top",
          }}
        >
          <div className="mx-auto max-w-5xl px-5 pt-20 text-center sm:px-6 md:pt-28">
            <p className="kicker anim-in">Self-hosted forms</p>
            <h1
              className="anim-in mx-auto mt-6 max-w-4xl text-[3.1rem] leading-[0.98] sm:text-7xl md:text-[5.6rem]"
              style={{ animationDelay: "80ms" }}
            >
              Ask the question.
              <br />
              <em className="italic">Keep</em> the answers.
            </h1>
            <p
              className="anim-in mx-auto mt-7 max-w-2xl text-lg font-light leading-relaxed text-[var(--color-body)] sm:text-xl"
              style={{ animationDelay: "160ms" }}
            >
              Probe is a form builder you run yourself. Every response goes to your own
              database, not someone else&apos;s, and there is no limit on how many you collect.
            </p>
            <div
              className="anim-in mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
              style={{ animationDelay: "240ms" }}
            >
              <Link href="/register" className="btn btn-primary px-6 py-3.5">
                Create a form
              </Link>
              <Link href="/docs" className="btn btn-ghost px-6 py-3.5">
                Read the docs
              </Link>
            </div>
          </div>

          <div className="mt-12 overflow-hidden" aria-hidden>
            <SignalDiagram />
          </div>
        </section>

        {/* ── What it does ─────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-24 sm:px-6 md:py-32">
          <div className="grid gap-12 md:grid-cols-[1fr_1.5fr] md:gap-16">
            <div>
              <p className="kicker">What it does</p>
              <h2 className="mt-5 text-4xl sm:text-5xl">
                A form builder, a form backend, and an API.
              </h2>
            </div>
            <div className="border-t border-probe-200">
              {WHAT.map(([term, desc]) => (
                <div
                  key={term}
                  className="grid gap-1 border-b border-probe-200 py-6 sm:grid-cols-[11rem_1fr] sm:items-baseline sm:gap-8"
                >
                  <div className="font-display text-[1.9rem] leading-none">{term}</div>
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
                    <div
                      className="h-1.5 w-2/3"
                      style={{ background: t.config.text, opacity: 0.85 }}
                    />
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
        <section className="bg-[#111211] text-[#F2EDE5]">
          <div className="mx-auto grid max-w-6xl gap-14 px-5 py-24 sm:px-6 md:grid-cols-2 md:items-center md:py-32">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C8963E]">
                For agents
              </p>
              <h2 className="mt-5 text-4xl sm:text-5xl">Give your agent a key. It does the rest.</h2>
              <p className="mt-6 max-w-md font-light leading-relaxed text-[#C9CCCA]">
                An API key lets a script or an AI agent build a form, publish it and read what
                comes back, without anyone opening the dashboard. Everything it needs to know is
                in one plain-text file.
              </p>
              <a
                href="/llms.txt"
                className="mt-8 inline-block border-b border-[#C8963E] pb-0.5 font-mono text-sm text-[#F2EDE5] hover:text-[#C8963E]"
              >
                probe.riftfi.com/llms.txt
              </a>
            </div>
            <pre className="overflow-x-auto border border-[#2C2F2D] bg-[#0B0C0B] p-6 font-mono text-[13px] leading-[1.75] text-[#C9CCCA]">
              <code>
                <span className="text-[#9AA09E]"># create a form</span>
                {"\n"}curl -X POST https://probe.riftfi.com/trpc/forms.create \
                {"\n"}  -H <span className="text-[#C8963E]">&quot;Authorization: Bearer probe_…&quot;</span> \
                {"\n"}  -d <span className="text-[#C8963E]">&apos;{"{"}&quot;json&quot;:{"{"}&quot;title&quot;:&quot;Field survey&quot;{"}}"}&apos;</span>
                {"\n\n"}
                <span className="text-[#9AA09E]"># publish it</span>
                {"\n"}curl -X POST …/trpc/forms.publish
                {"\n\n"}
                <span className="text-[#9AA09E]"># read the answers</span>
                {"\n"}curl …/trpc/responses.list
                {"\n"}
                <span className="anim-blink inline-block h-[1.1em] w-[0.55em] translate-y-[0.2em] bg-[#C8963E]" />
              </code>
            </pre>
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
                      className="font-mono text-lg text-probe-500 transition-transform group-open:rotate-45"
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
          <h2 className="text-5xl sm:text-7xl">Start collecting.</h2>
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

/** A plain, believable form — what respondents actually see. */
function FormSpecimen() {
  return (
    <div className="border border-probe-200 bg-[var(--color-surface)] p-8 sm:p-10" aria-hidden>
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-probe-700">
        probe.riftfi.com/f/site-visit
      </div>
      <div className="mt-6 font-display text-[2rem] leading-tight">Site visit request</div>
      <p className="mt-2 text-sm font-light text-[var(--color-body)]">
        Tell us where and when. We reply within a day.
      </p>
      <div className="mt-8 space-y-5">
        <Field label="Company" value="Kilima Solar Ltd" />
        <Field label="Location" value="Naivasha, Nakuru County" />
        <div>
          <div className="mb-2 text-sm font-medium">Preferred week</div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {["12 May", "19 May", "26 May"].map((w, i) => (
              <div
                key={w}
                className={`border px-3 py-2 text-center ${
                  i === 1 ? "border-probe-900 bg-probe-900 text-probe-50" : "border-probe-200"
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
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium">{label}</div>
      <div className="border border-[#DCD3C3] bg-[var(--color-surface)] px-3 py-2.5 text-sm">
        {value}
      </div>
    </div>
  );
}

/**
 * Line-art map of a Probe install: forms, pages and agents orbit your server;
 * gold signals travel in, a webhook travels out. Pure SVG + SMIL, no images.
 */
function SignalDiagram() {
  const ink = "var(--color-probe-900)";
  const gold = "var(--color-gold)";
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

      {/* sun */}
      <circle cx="600" cy="330" r="92" fill={gold} fillOpacity="0.85" />

      {/* the server: a drawn database stack */}
      <g>
        <path d="M548 250 V 478 A 52 14 0 0 0 652 478 V 250" fill={paper} stroke={ink} strokeWidth="1.4" />
        <ellipse cx="600" cy="250" rx="52" ry="14" fill={paper} stroke={ink} strokeWidth="1.4" />
        {[318, 386, 454].map((y) => (
          <path key={y} d={`M548 ${y} A 52 14 0 0 0 652 ${y}`} stroke={ink} strokeWidth="1" />
        ))}
        {[284, 352, 420].map((y) => (
          <g key={y}>
            <circle cx="566" cy={y} r="2.5" fill={y === 284 ? gold : ink} className="anim-pulse" />
            <line x1="578" y1={y} x2="630" y2={y} stroke={ink} strokeOpacity="0.35" />
          </g>
        ))}
        {/* antenna */}
        <line x1="600" y1="236" x2="600" y2="156" stroke={ink} strokeWidth="1.4" />
        <circle cx="600" cy="150" r="6" fill={ink} />
        <circle cx="600" cy="150" r="18" stroke={ink} strokeOpacity="0.4" strokeDasharray="2 4" className="anim-spin-slow" />
        <circle cx="600" cy="150" r="32" stroke={ink} strokeOpacity="0.2" />
        <text x="616" y="214" fontFamily="var(--font-mono)" fontSize="11" fill={ink} fillOpacity="0.7" letterSpacing="1.5">
          YOUR SERVER
        </text>
      </g>

      {/* links + travelling signals */}
      {nodes.map((n, i) => (
        <g key={n.label}>
          <path id={`sig-${i}`} d={n.path} stroke={ink} strokeOpacity="0.5" strokeDasharray="3 5" />
          <circle r="4" fill={gold} stroke={ink} strokeWidth="1">
            <animateMotion dur={`${4.2 + i * 0.7}s`} begin={`-${i * 0.9}s`} repeatCount="indefinite" rotate="auto">
              <mpath href={`#sig-${i}`} />
            </animateMotion>
          </circle>
          <circle cx={n.x} cy={n.y} r="9" fill={paper} stroke={ink} strokeWidth="1.4" />
          <circle cx={n.x} cy={n.y} r="3" fill={n.out ? gold : ink} />
          <text
            x={n.anchor === "end" ? n.x - 18 : n.x + 18}
            y={n.y - 4}
            textAnchor={n.anchor}
            fontFamily="var(--font-display)"
            fontSize="26"
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
