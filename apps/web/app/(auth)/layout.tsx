import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--color-probe-900) 4%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--color-probe-900) 4%, transparent) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <header className="relative border-b border-probe-200 bg-[var(--color-surface)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center">
          <Link href="/" className="display text-xl font-bold text-probe-900">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="relative flex-1 flex items-center justify-center px-5 py-12 sm:px-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
