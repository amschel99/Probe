import Link from "next/link";
import { Logo } from "@/components/logo";

import { ThemeToggle } from "@/components/theme-toggle";

const NAV: [string, string][] = [
  ["/explore", "Explore"],
  ["/templates", "Templates"],
  ["/docs", "Docs"],
  ["/api/docs", "API"],
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-probe-200 bg-[var(--color-surface)]/90 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
          <Link href="/" className="text-probe-900" aria-label="Probe home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
            {NAV.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="hidden px-3 py-2 font-mono text-[12.5px] text-probe-900 hover:text-probe-500 md:inline"
              >
                {label}
              </Link>
            ))}
            <Link
              href="/login"
              className="hidden px-3 py-2 font-mono text-[12.5px] text-probe-900 hover:text-probe-500 sm:inline"
            >
              Log in
            </Link>
            <Link href="/register" className="btn btn-primary ml-1 whitespace-nowrap">
              Get started
            </Link>
            <ThemeToggle className="ml-1" />
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-probe-200 bg-[var(--color-surface)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 pt-16 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <p className="max-w-xs font-light leading-relaxed text-[var(--color-body)]">
            Forms you run yourself. Your server, your database, your rules.
          </p>
          <FooterCol
            title="Product"
            links={[
              ["/explore", "Explore"],
              ["/templates", "Themes"],
              ["/templates/html", "HTML templates"],
              ["/pricing", "Pricing"],
            ]}
          />
          <FooterCol
            title="Developers"
            links={[
              ["/docs", "Docs"],
              ["/api/docs", "API reference"],
              ["/llms.txt", "llms.txt"],
              ["/openapi.json", "OpenAPI"],
            ]}
          />
          <FooterCol
            title="Project"
            links={[
              ["/open-source", "Open source"],
              [process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/amschel99/Probe", "GitHub"],
              ["/login", "Log in"],
              ["/register", "Sign up"],
            ]}
          />
        </div>
        <div className="mx-auto max-w-6xl overflow-hidden px-5 sm:px-6">
          <div
            aria-hidden
            className="select-none font-display text-[28vw] leading-[0.8] tracking-[-0.04em] text-probe-900 md:text-[17rem]"
          >
            Probe
          </div>
        </div>
        <div className="border-t border-probe-200">
          <div className="mx-auto flex max-w-6xl flex-col justify-between gap-2 px-5 py-5 font-mono text-[11px] text-probe-700 sm:flex-row sm:px-6">
            <span>© {new Date().getFullYear()} Probe</span>
            <span>MIT licence · based on ChaiForm</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-probe-700">{title}</div>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map(([href, label]) => (
          <li key={label}>
            <a href={href} className="text-probe-900 hover:text-probe-500">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
