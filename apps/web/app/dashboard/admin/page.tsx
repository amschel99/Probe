"use client";

import Link from "next/link";
import { useState } from "react";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

import { AdminForms } from "./_components/admin-forms";
import { AdminOverview } from "./_components/admin-overview";
import { AdminUsers } from "./_components/admin-users";
import { IntegrationsAdmin } from "./_components/integrations-admin";

type Tab = "overview" | "forms" | "users" | "integrations";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "forms", label: "Forms" },
  { key: "users", label: "Users" },
  { key: "integrations", label: "Integrations" },
];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");

  const statsQuery = trpc.admin.getStats.useQuery(undefined, {
    retry: false,
  });
  const meQuery = trpc.auth.me.useQuery();

  // Self-guard: non-admins get a 403 (FORBIDDEN) from the role-gated router.
  if (statsQuery.error?.data?.code === "FORBIDDEN") {
    return (
      <div className="max-w-md mx-auto card text-center py-12">
        <div className="text-3xl mb-2">🔒</div>
        <h1 className="display text-2xl font-bold mb-1">Admins only</h1>
        <p className="text-probe-700 mb-6">
          You don&apos;t have permission to view the admin dashboard.
        </p>
        <Link href="/dashboard" className="btn btn-primary">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-3xl font-bold">Admin</h1>
        <p className="text-probe-700 mt-1">
          Platform-wide moderation across all users, forms and accounts.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-probe-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px",
              tab === t.key
                ? "border-probe-500 text-probe-900"
                : "border-transparent text-probe-700 hover:text-probe-900",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          {statsQuery.isLoading && <p className="text-probe-700">Loading…</p>}
          {statsQuery.isError && (
            <p className="text-red-600">
              Failed to load stats: {statsQuery.error.message}
            </p>
          )}
          {statsQuery.data && <AdminOverview stats={statsQuery.data} />}
        </>
      )}

      {tab === "forms" && <AdminForms />}

      {tab === "users" && <AdminUsers currentUserId={meQuery.data?.id} />}

      {tab === "integrations" && <IntegrationsAdmin />}
    </div>
  );
}
