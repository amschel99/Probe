import Link from "next/link";
import { Logo } from "@/components/logo";

import { ChaiFooter } from "@/components/chai-footer";

import { DashboardNav } from "./_components/dashboard-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-probe-200 bg-probe-50/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <Link href="/dashboard" className="display text-lg font-bold">
            <Logo />
          </Link>
          <DashboardNav />
        </div>
      </header>
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex-1">{children}</main>
      <ChaiFooter />
    </div>
  );
}
