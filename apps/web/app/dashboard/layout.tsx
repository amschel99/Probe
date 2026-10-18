import Link from "next/link";
import { Logo } from "@/components/logo";

import { ChaiFooter } from "@/components/chai-footer";

import { DashboardNav } from "./_components/dashboard-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-probe-50 flex flex-col">
      <header className="border-b border-probe-200 bg-surface">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="display text-lg font-bold">
            <Logo />
          </Link>
          <DashboardNav />
        </div>
      </header>
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1">{children}</main>
      <ChaiFooter />
    </div>
  );
}
