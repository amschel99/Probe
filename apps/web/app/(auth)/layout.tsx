import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <header className="relative border-b border-probe-200 bg-[var(--color-surface)]">
        <div className="px-5 sm:px-10 h-[76px] sm:h-[88px] flex items-center">
          <Link href="/" className="display text-xl font-bold text-probe-900">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="relative flex-1 flex items-center justify-center bg-probe-100 px-5 py-12 sm:px-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
