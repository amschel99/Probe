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
    <nav className="order-last flex w-full items-center gap-2 text-sm md:order-none md:w-auto" aria-label="Dashboard">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto border border-probe-200 bg-[var(--color-surface)] p-1 md:flex-none">
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
                "shrink-0 whitespace-nowrap px-3 py-1.5 font-mono text-[12px] transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-probe-500 focus-visible:ring-offset-1",
                active
                  ? "bg-probe-900 text-probe-50"
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
        className="btn btn-ghost shrink-0 px-3 py-1.5 text-[13px]"
      >
        Log out
      </button>
      <ThemeToggle />
    </nav>
  );
}
