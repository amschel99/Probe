"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type FormTabsProps = {
  /** Form id, used to build each tab href. */
  id: string;
  /** Optional response count shown on the Responses tab. */
  responseCount?: number;
  /** Optional publish/unpublish action rendered to the right of the tabs. */
  action?: React.ReactNode;
};

/**
 * Cohesive segmented tab group for a single form's sub-routes
 * (Builder / Responses / Analytics / Share). The active tab is derived from
 * the current pathname so it stays in sync across client-side navigations.
 */
export function FormTabs({ id, responseCount, action }: FormTabsProps) {
  const pathname = usePathname();
  const base = `/dashboard/forms/${id}`;

  const tabs = [
    { href: base, label: "Builder", exact: true },
    {
      href: `${base}/responses`,
      label: typeof responseCount === "number" ? `Responses · ${responseCount}` : "Responses",
    },
    { href: `${base}/analytics`, label: "Analytics" },
    { href: `${base}/share`, label: "Share" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav
        aria-label="Form sections"
        className="inline-flex items-center gap-1 rounded-[2px] border border-probe-200 bg-surface p-1 shadow-sm"
      >
        {tabs.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-[2px] px-3 py-1.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-probe-500 focus-visible:ring-offset-1",
                active
                  ? "bg-probe-900 text-probe-50"
                  : "text-probe-700 hover:bg-probe-100 hover:text-probe-900",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
