"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const baseLinks = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/forms", label: "Hosted forms" },
  { href: "/dashboard/endpoint-forms", label: "Endpoint forms" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const meQuery = trpc.auth.me.useQuery();

  const links =
    meQuery.data?.role === "admin"
      ? [...baseLinks, { href: "/dashboard/admin", label: "Admin" }]
      : baseLinks;

  async function logout() {
    await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
    router.push("/login");
  }

  return (
    <nav className="flex items-center gap-2 text-sm" aria-label="Dashboard">
      <div className="inline-flex items-center gap-1 rounded-xl border border-probe-200 bg-probe-50 p-1">
        {links.map((l) => {
          const active =
            l.href === "/dashboard"
              ? pathname === l.href
              : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-probe-500 focus-visible:ring-offset-1",
                active
                  ? "bg-probe-500 text-white shadow-sm"
                  : "text-probe-700 hover:bg-probe-100 hover:text-probe-900",
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
      <button
        onClick={logout}
        className="rounded-lg border border-probe-200 px-3 py-1.5 font-medium text-probe-700 transition-colors hover:bg-probe-100 hover:text-probe-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-probe-500 focus-visible:ring-offset-1"
      >
        Log out
      </button>
      <ThemeToggle />
    </nav>
  );
}
