import type { RouterOutputs } from "@repo/trpc/client";
import Link from "next/link";

import { api } from "@/lib/trpc-server";
import { applyThemeVars } from "@/lib/utils";

type Theme = RouterOutputs["themes"]["list"][number];

const FEATURES: { kicker: string; title: string; body: string }[] = [
  {
    kicker: "01",
    title: "Two surfaces, one builder",
    body: "Ship a hosted form with a beautiful URL, or grab an API endpoint and bolt it onto the HTML you already have.",
  },
  {
    kicker: "02",
    title: "Drag, drop, done",
    body: "Sortable fields with conditional logic. Auto-saves as you go. Preview without ever leaving the canvas.",
  },
  {
    kicker: "03",
    title: "Responses & analytics",
    body: "Real-time view / start / submit / abandon tracking and CSV export. No third-party analytics SDK phoning home.",
  },
  {
    kicker: "04",
    title: "Security, pre-brewed",
    body: "Honeypot, captcha, origin allowlist, recipient verification, and AES-GCM for every stored secret.",
  },
  {
    kicker: "05",
    title: "One docker image",
    body: "One container, one origin, one DNS record. No CORS gymnastics. Ships with Kamal out of the box.",
  },
  {
    kicker: "06",
    title: "Themes with a personality",
    body: "Matrix, Cyberpunk, Minecraft, Windows Vista (unironic). Switch the entire vibe in two clicks.",
  },
];

/** The satirical price comparison — rendered as a café receipt. */
const RECEIPT: { item: string; price: string; note: string }[] = [
  { item: "Google Forms", price: "$0", note: "Looks like a tax return" },
  { item: "Typeform", price: "$$$", note: "Pricier than your Netflix" },
  { item: "Probe", price: "$0", note: "Free. Open source. Tasty." },
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
      {/* Scoped, reduced-motion-aware entrance animations. Lives here because
          globals.css is owned by another agent. No motion when the user has
          asked for less of it. */}
      <style>{`
        .cf-rise { opacity: 0; transform: translateY(14px); animation: cf-rise .7s cubic-bezier(.2,.7,.2,1) forwards; }
        .cf-d1 { animation-delay: .05s } .cf-d2 { animation-delay: .15s }
        .cf-d3 { animation-delay: .25s } .cf-d4 { animation-delay: .35s }
        @keyframes cf-rise { to { opacity: 1; transform: none } }
        .cf-steam { transform-origin: bottom center; animation: cf-steam 3.4s ease-in-out infinite; }
        .cf-steam-2 { animation-delay: 1.1s } .cf-steam-3 { animation-delay: 2.2s }
        @keyframes cf-steam {
          0%,100% { opacity:.15; transform: translateY(2px) scaleY(.9) }
          50% { opacity:.6; transform: translateY(-6px) scaleY(1.05) }
        }
        @media (prefers-reduced-motion: reduce) {
          .cf-rise { opacity: 1; transform: none; animation: none }
          .cf-steam { animation: none; opacity: .35 }
        }
      `}</style>

      {/* Skip link — first focusable element on the page. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-probe-900 focus:px-4 focus:py-2 focus:text-probe-50 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-probe-500"
      >
        Skip to main content
      </a>

      <div id="main-content">
        {/* ── Hero ────────────────────────────────────────────────── */}
        <section
          aria-labelledby="hero-heading"
          className="relative overflow-hidden border-b border-probe-200"
        >
          {/* Atmosphere: warm radial glow + dotted grain. Decorative only. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(60% 50% at 50% -10%, color-mix(in srgb, var(--color-probe-200) 70%, transparent) 0%, transparent 70%), radial-gradient(var(--color-probe-200) 1px, transparent 1px)",
              backgroundSize: "auto, 22px 22px",
              opacity: 0.7,
            }}
          />

          <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 md:pt-28">
            <p className="cf-rise mx-auto mb-7 flex w-fit flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-probe-200 bg-white/70 px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-probe-700 backdrop-blur">
              <span>Open source</span>
              <span aria-hidden="true" className="text-probe-500">
                &bull;
              </span>
              <span>Satirically serious</span>
              <span aria-hidden="true" className="text-probe-500">
                &bull;
              </span>
              <span>Actually works</span>
            </p>

            <h1
              id="hero-heading"
              className="cf-rise cf-d1 display mx-auto max-w-4xl text-center text-5xl font-bold leading-[1.05] tracking-tight text-probe-900 md:text-7xl"
            >
              Forms worth
              <span className="relative mx-3 inline-block whitespace-nowrap text-probe-500">
                pouring
                {/* Hand-drawn underline accent. */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 200 18"
                  preserveAspectRatio="none"
                  className="absolute -bottom-2 left-0 h-3 w-full text-probe-500"
                >
                  <path
                    d="M2 12 C 50 4, 150 4, 198 11"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              your data into.
            </h1>

            <p className="cf-rise cf-d2 mx-auto mt-7 max-w-2xl text-center text-lg text-probe-700 md:text-xl">
              Google Forms has the design sense of a tax return. Typeform costs
              more than your Netflix. Probe is{" "}
              <strong className="font-semibold text-probe-900">free</strong>,{" "}
              <strong className="font-semibold text-probe-900">open source</strong>
              , genuinely pretty, and and entirely yours.
            </p>

            <div className="cf-rise cf-d3 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link href="/register" className="btn btn-primary">
                Build your first form
              </Link>
              <Link href="/explore" className="btn btn-ghost">
                See it in the wild
              </Link>
            </div>

            {/* The mascot cup with animated steam. Decorative, hidden from AT. */}
            <div
              aria-hidden="true"
              className="cf-rise cf-d4 mx-auto mt-14 flex w-fit flex-col items-center"
            >
              <div className="mb-1 flex gap-2 text-probe-500">
                <span className="cf-steam block h-6 w-0.5 rounded-full bg-current" />
                <span className="cf-steam cf-steam-2 block h-7 w-0.5 rounded-full bg-current" />
                <span className="cf-steam cf-steam-3 block h-5 w-0.5 rounded-full bg-current" />
              </div>
              <div className="rounded-2xl border border-probe-200 bg-white px-6 py-3 text-4xl shadow-sm">
                🔎
              </div>
            </div>
          </div>
        </section>

        {/* ── The Receipt (price satire) ──────────────────────────── */}
        <section
          aria-labelledby="receipt-heading"
          className="mx-auto max-w-6xl px-6 py-20"
        >
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-probe-500">
                The math, plainly
              </p>
              <h2
                id="receipt-heading"
                className="display text-3xl font-bold leading-tight text-probe-900 md:text-4xl"
              >
                Other form builders hand you a bill.
                <br />
                We hand you a receipt for nothing.
              </h2>
              <p className="mt-5 max-w-md text-probe-700">
                No seats. No &ldquo;contact sales.&rdquo; No watermark begging you
                to upgrade. Self-host it or use ours &mdash; the price is the same
                cup of nothing.
              </p>
              <Link href="/pricing" className="btn btn-ghost mt-7">
                Read the (very short) pricing
              </Link>
            </div>

            {/* Receipt card */}
            <div className="relative mx-auto w-full max-w-sm">
              <div
                className="rounded-2xl border border-probe-200 bg-white p-7 shadow-[0_18px_50px_-24px_rgba(59,42,26,0.45)]"
                role="presentation"
              >
                <div className="mb-5 border-b border-dashed border-probe-200 pb-4 text-center">
                  <p className="display text-xl font-bold text-probe-900">
                    PROBE &amp; CO.
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-probe-500">
                    Form builders compared
                  </p>
                </div>
                <ul className="space-y-4 font-mono text-sm">
                  {RECEIPT.map((row) => (
                    <li
                      key={row.item}
                      className="flex items-baseline justify-between gap-4"
                    >
                      <span className="flex-1">
                        <span className="block font-semibold text-probe-900">
                          {row.item}
                        </span>
                        <span className="text-xs text-probe-700">{row.note}</span>
                      </span>
                      <span className="shrink-0 font-bold text-probe-500">
                        {row.price}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex items-baseline justify-between border-t border-dashed border-probe-200 pt-4 font-mono">
                  <span className="font-bold uppercase tracking-wide text-probe-900">
                    Total
                  </span>
                  <span className="font-bold text-probe-500">$0.00</span>
                </div>
                <p className="mt-4 text-center text-xs text-probe-700">
                  Thank you. Come back any time.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Feature grid ────────────────────────────────────────── */}
        <section
          aria-labelledby="features-heading"
          className="border-y border-probe-200 bg-white"
        >
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2
              id="features-heading"
              className="display max-w-2xl text-3xl font-bold leading-tight text-probe-900 md:text-4xl"
            >
              Everything a form needs.
              <span className="text-probe-500"> Nothing it doesn&apos;t.</span>
            </h2>
            <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-probe-200 bg-probe-200 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li
                  key={f.title}
                  className="group bg-white p-7 transition-colors hover:bg-probe-50"
                >
                  <span
                    aria-hidden="true"
                    className="display block text-2xl font-bold text-probe-200 transition-colors group-hover:text-probe-500"
                  >
                    {f.kicker}
                  </span>
                  <h3 className="display mt-3 text-xl font-bold text-probe-900">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-probe-700">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Theme gallery (live data) ───────────────────────────── */}
        {themes.length > 0 && (
          <section
            aria-labelledby="themes-heading"
            className="mx-auto max-w-6xl px-6 py-20"
          >
            <div className="max-w-2xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-probe-500">
                {themes.length} live themes
              </p>
              <h2
                id="themes-heading"
                className="display text-3xl font-bold leading-tight text-probe-900 md:text-4xl"
              >
                Every one of them an aesthetic crime.
              </h2>
              <p className="mt-3 text-probe-700">
                Mostly on purpose. Each preview below is painted with that
                theme&apos;s own real colours and fonts &mdash; the same config
                your respondents will see.
              </p>
            </div>

            <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {themes.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/explore?theme=${encodeURIComponent(t.slug)}`}
                    aria-label={`Preview the ${t.name} theme (${t.category})`}
                    className="block h-full rounded-2xl outline-offset-4 transition-transform duration-200 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-probe-500 motion-reduce:transform-none motion-reduce:transition-none"
                  >
                    <div
                      className="flex h-full flex-col gap-2 rounded-2xl border p-4"
                      style={{
                        ...applyThemeVars(t.config),
                        background: t.config.surface,
                        color: t.config.text,
                        borderColor: t.config.border,
                        fontFamily: t.config.fontFamily,
                      }}
                    >
                      <span aria-hidden="true" className="text-2xl leading-none">
                        {t.config.logoEmoji || "🎨"}
                      </span>
                      <span className="font-bold leading-tight">{t.name}</span>
                      {/* Swatch row of the theme's actual palette. */}
                      <span
                        aria-hidden="true"
                        className="mt-auto flex gap-1.5 pt-2"
                      >
                        {[
                          t.config.accent,
                          t.config.text,
                          t.config.border,
                        ].map((c, i) => (
                          <span
                            key={i}
                            className="h-3 w-3 rounded-full"
                            style={{
                              background: c,
                              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)",
                            }}
                          />
                        ))}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: t.config.textMuted, opacity: 0.9 }}
                      >
                        {t.category}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Endpoint forms callout ──────────────────────────────── */}
        <section
          aria-labelledby="endpoint-heading"
          className="border-t border-probe-200 bg-white"
        >
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="grid items-center gap-10 rounded-3xl border border-probe-200 bg-probe-50 p-8 md:grid-cols-2 md:p-12">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-probe-500">
                  For your client sites
                </p>
                <h2
                  id="endpoint-heading"
                  className="display text-3xl font-bold leading-tight text-probe-900 md:text-4xl"
                >
                  Endpoint forms.
                  <br />
                  No UI required.
                </h2>
                <p className="mt-5 max-w-md text-probe-700">
                  Paste a plain HTML form on your client&apos;s site. We handle
                  delivery, anti-spam, captcha, rate limits, and webhooks. You
                  handle the invoice.
                </p>
                <Link
                  href="/dashboard/endpoint-forms/new"
                  className="btn btn-primary mt-7"
                >
                  Create an endpoint
                </Link>
              </div>

              <div className="overflow-hidden rounded-2xl border border-probe-900/40 bg-probe-900 shadow-[0_18px_50px_-24px_rgba(59,42,26,0.6)]">
                <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                  <span aria-hidden="true" className="h-3 w-3 rounded-full bg-probe-500" />
                  <span aria-hidden="true" className="h-3 w-3 rounded-full bg-probe-200" />
                  <span aria-hidden="true" className="h-3 w-3 rounded-full bg-probe-100" />
                  <span className="ml-2 font-mono text-xs text-probe-100/70">
                    contact-form.html
                  </span>
                </div>
                <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-probe-50">
                  <code>{`<form
  action="https://probe.riftfi.com/submit"
  method="POST">
  <input type="hidden" name="access_key" value="YOUR_KEY">
  <input name="name" required>
  <input name="email" type="email" required>
  <textarea name="message"></textarea>
  <button type="submit">Send</button>
</form>`}</code>
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ───────────────────────────────────────────── */}
        <section
          aria-labelledby="cta-heading"
          className="relative overflow-hidden border-t border-probe-200"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(50% 60% at 50% 120%, color-mix(in srgb, var(--color-probe-200) 80%, transparent) 0%, transparent 70%)",
            }}
          />
          <div className="relative mx-auto max-w-3xl px-6 py-24 text-center">
            <h2
              id="cta-heading"
              className="display text-4xl font-bold leading-tight text-probe-900 md:text-5xl"
            >
              Your next form is one cup away.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-probe-700">
              Free forever, open source, and self-hostable in a single container.
              Steep, ship, collect.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link href="/register" className="btn btn-primary">
                Start brewing &mdash; it&apos;s free
              </Link>
              <Link href="/open-source" className="btn btn-ghost">
                Read the source
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
