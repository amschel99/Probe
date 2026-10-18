"use client";

import Link from "next/link";

import { trpc } from "@/lib/trpc";
import { formatRelative } from "@/lib/utils";

import type { AdminStats } from "./types";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase font-semibold text-probe-700">{label}</div>
      <div className="display text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}

function Breakdown({
  title,
  entries,
}: {
  title: string;
  entries: { label: string; count: number }[];
}) {
  const total = entries.reduce((s, e) => s + e.count, 0);
  const max = Math.max(1, ...entries.map((e) => e.count));
  return (
    <div className="card">
      <div className="font-semibold text-sm mb-3">{title}</div>
      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.label} className="text-sm">
            <div className="flex justify-between mb-0.5">
              <span className="capitalize">{e.label}</span>
              <span className="text-probe-700 tabular-nums">
                {e.count}
                {total > 0 && (
                  <span className="text-probe-500 ml-1">
                    ({Math.round((e.count / total) * 100)}%)
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 rounded-full bg-probe-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-probe-500"
                style={{ width: `${(e.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminOverview({ stats }: { stats: AdminStats }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Users" value={stats.totalUsers} />
        <Stat label="Forms" value={stats.totalForms} />
        <Stat label="Responses" value={stats.totalResponses} />
        <Stat label="Themes" value={stats.totalThemes} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Breakdown
          title="Forms by status"
          entries={[
            { label: "draft", count: stats.formsByStatus.draft },
            { label: "published", count: stats.formsByStatus.published },
            { label: "archived", count: stats.formsByStatus.archived },
          ]}
        />
        <Breakdown
          title="Forms by visibility"
          entries={[
            { label: "public", count: stats.formsByVisibility.public },
            { label: "unlisted", count: stats.formsByVisibility.unlisted },
          ]}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="display text-lg font-bold mb-3">Recent signups</h3>
          {stats.recentSignups.length === 0 ? (
            <p className="text-sm text-probe-700">No signups yet.</p>
          ) : (
            <ul className="divide-y divide-probe-100">
              {stats.recentSignups.map((u) => (
                <li key={u.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{u.name || u.email}</div>
                    <div className="text-xs text-probe-700 truncate">{u.email}</div>
                  </div>
                  <div className="text-right shrink-0">
                    {u.role === "admin" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-probe-100 text-probe-900 uppercase">
                        admin
                      </span>
                    )}
                    <div className="text-xs text-probe-700 mt-0.5">
                      {formatRelative(u.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3 className="display text-lg font-bold mb-3">Top forms</h3>
          {stats.topForms.length === 0 ? (
            <p className="text-sm text-probe-700">No forms yet.</p>
          ) : (
            <ul className="divide-y divide-probe-100">
              {stats.topForms.map((f) => (
                <li key={f.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/f/${f.slug}`}
                      className="font-semibold truncate hover:underline block"
                    >
                      {f.title}
                    </Link>
                    <div className="text-xs text-probe-700 truncate">{f.ownerEmail}</div>
                  </div>
                  <span className="text-sm tabular-nums text-probe-700 shrink-0">
                    {f.responseCount} resp.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="text-xs text-probe-500">
        {stats.totalAnalyticsEvents.toLocaleString()} analytics events tracked across all forms.
      </p>
    </div>
  );
}
