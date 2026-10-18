import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-probe-200 bg-probe-50/80">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center">
          <Link href="/" className="display text-xl font-bold text-probe-900">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
