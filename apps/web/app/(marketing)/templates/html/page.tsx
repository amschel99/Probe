import Link from "next/link";

import { HTML_TEMPLATES, templateFilePath } from "@/lib/html-templates";

export const metadata = {
  title: "HTML templates — Probe",
  description:
    "Free, downloadable HTML pages with a working form backend built in. Add your access key and deploy anywhere.",
};

const STEPS = [
  {
    title: "Download a template",
    body: "Grab the HTML file below. No account needed to take it.",
  },
  {
    title: "Get your access key",
    body: "Sign up, then Dashboard → Endpoint Forms → New. Add a name + your website and verify the email we send — submissions only deliver once verified.",
  },
  {
    title: "Paste your key",
    body: "Replace YOUR_ACCESS_KEY in the file with the key from your dashboard.",
  },
  {
    title: "Deploy anywhere",
    body: "It's a plain HTML file — host it on Netlify, GitHub Pages, or your own server. No build step.",
  },
  {
    title: "Watch responses roll in",
    body: "Submissions land in your inbox and your Probe dashboard. Honeypot + origin checks are already wired in.",
  },
];

export default function HtmlTemplatesPage() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <div className="max-w-2xl">
        <Link href="/templates" className="text-sm text-probe-700 hover:text-probe-500">
          ← Templates
        </Link>
        <h1 className="display text-4xl font-bold mt-3">HTML page templates</h1>
        <p className="text-probe-700 mt-3 text-lg">
          Drop-in HTML pages with a working form backend baked in. Download one, add your
          access key, and deploy it anywhere — no server code, no JavaScript framework, no
          build step. Submissions go straight to your inbox and dashboard.
        </p>
      </div>

      {/* How it works */}
      <div className="card mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="display text-xl font-bold">How it works</h2>
          <Link href="/dashboard/endpoint-forms/new" className="btn btn-primary text-sm">
            Generate an access key
          </Link>
        </div>
        <ol className="grid md:grid-cols-5 gap-4 mt-6 list-none">
          {STEPS.map((step, i) => (
            <li key={step.title} className="text-sm">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-probe-500 text-white font-bold text-xs">
                {i + 1}
              </div>
              <div className="font-semibold mt-2 text-probe-900">{step.title}</div>
              <p className="text-probe-700 mt-1">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Gallery */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-6 mt-10">
        {HTML_TEMPLATES.map((t) => {
          const file = templateFilePath(t.slug);
          return (
            <div key={t.slug} className="card flex flex-col">
              {/* Live, non-interactive preview of the actual file */}
              <div className="relative rounded-xl overflow-hidden border border-probe-200 bg-probe-50 h-64">
                <iframe
                  src={file}
                  title={`${t.name} preview`}
                  className="w-full h-full pointer-events-none"
                  loading="lazy"
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </div>

              <div className="flex items-center gap-2 mt-4">
                <span className="text-xl">{t.emoji}</span>
                <h3 className="font-bold text-lg">{t.name}</h3>
              </div>
              <p className="text-sm text-probe-700 mt-1">{t.description}</p>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {t.fields.map((f) => (
                  <span
                    key={f}
                    className="text-xs bg-probe-100 text-probe-700 rounded-full px-2.5 py-0.5"
                  >
                    {f}
                  </span>
                ))}
              </div>

              <div className="flex gap-2 mt-5 pt-4 border-t border-probe-100">
                {/* `download` makes the browser save the file rather than render it */}
                <a href={file} download className="btn btn-primary text-sm">
                  Download HTML
                </a>
                <a
                  href={file}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost text-sm"
                >
                  Preview
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-probe-700 mt-10">
        Want a fully hosted, themed form instead?{" "}
        <Link href="/templates" className="underline">
          Browse themes
        </Link>{" "}
        or{" "}
        <Link href="/dashboard/forms/new" className="underline">
          build one from scratch
        </Link>
        .
      </p>
    </section>
  );
}
