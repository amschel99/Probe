import Link from "next/link";
import { Logo } from "@/components/logo";

import { ThemeToggle } from "@/components/theme-toggle";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-probe-200 bg-probe-50/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="display text-xl font-bold text-probe-900">
            <Logo />
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link href="/explore" className="text-probe-900 hover:text-probe-500">Explore</Link>
            <Link href="/templates" className="text-probe-900 hover:text-probe-500">Templates</Link>
            <Link href="/pricing" className="text-probe-900 hover:text-probe-500">Pricing</Link>
            <Link href="/open-source" className="text-probe-900 hover:text-probe-500">Open Source</Link>
            <Link href="/docs" className="text-probe-900 hover:text-probe-500">Docs</Link>
            <a href="/api/docs" className="text-probe-900 hover:text-probe-500">API</a>
            <Link href="/login" className="text-probe-900 hover:text-probe-500">Login</Link>
            <Link href="/register" className="btn btn-primary text-sm">Get started</Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-probe-200 bg-surface">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-probe-700">
          <div>Probe — self-hosted forms</div>
          <div className="flex gap-4">
            <Link href="/open-source">Open source</Link>
            <a href={process.env.NEXT_PUBLIC_GITHUB_URL ?? "#"} target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
