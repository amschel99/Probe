import Link from "next/link";
import { Logo } from "@/components/logo";

import { ThemeToggle } from "@/components/theme-toggle";

const NAV: [string, string][] = [
  ["/explore", "Explore"],
  ["/templates", "Templates"],
  ["/pricing", "Pricing"],
  ["/docs", "Docs"],
  ["/api/docs", "API"],
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-probe-200 bg-probe-50/75 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
          <Link href="/" className="text-xl font-bold text-probe-900" aria-label="Probe home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded px-3 py-2 font-mono text-[12px] uppercase tracking-[0.12em] text-probe-700 transition-colors hover:text-probe-900"
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden px-2 text-sm font-medium text-probe-700 hover:text-probe-900 sm:inline"
            >
              Log in
            </Link>
            <Link href="/register" className="btn btn-primary text-sm">
              Get started
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-probe-200 bg-[var(--color-surface)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo className="text-lg font-bold" />
            <p className="mt-3 max-w-xs text-sm text-probe-700">
              Self-hosted forms. Your server, your database, your rules.
            </p>
            <p className="mt-5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-probe-700">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-cyan)]" />
              All systems nominal
            </p>
          </div>
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
        <div className="border-t border-probe-200">
          <div className="mx-auto flex max-w-6xl flex-col justify-between gap-2 px-5 py-5 font-mono text-[11px] uppercase tracking-[0.12em] text-probe-700 sm:flex-row sm:px-6">
            <span>© {new Date().getFullYear()} Probe</span>
            <span>MIT licensed · based on ChaiForm</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="kicker">{title}</div>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map(([href, label]) => (
          <li key={label}>
            <a href={href} className="text-probe-700 transition-colors hover:text-probe-900">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
