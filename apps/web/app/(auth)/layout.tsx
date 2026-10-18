import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--color-probe-500) 26%, transparent), transparent 62%)",
        }}
      />
      <header className="relative border-b border-probe-200 bg-probe-50/75 backdrop-blur-md">
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
