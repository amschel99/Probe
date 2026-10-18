"use client";

import Link from "next/link";

import { trpc } from "@/lib/trpc";
import { formatRelative } from "@/lib/utils";

export default function FormsListPage() {
  const { data, isLoading } = trpc.forms.list.useQuery({ limit: 50 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display text-3xl font-bold">Hosted forms</h1>
          <p className="text-probe-700 mt-1">Themed forms with their own URL. Embed-friendly.</p>
        </div>
        <Link href="/dashboard/forms/new" className="btn btn-primary">+ New form</Link>
      </div>

      <div className="card">
        {isLoading && <p className="text-probe-700">Loading…</p>}
        {!isLoading && data?.items.length === 0 && (
          <div className="text-center py-12">
            <div className="text-3xl mb-2 text-probe-500" aria-hidden>✦</div>
            <p className="text-probe-700">No forms yet.</p>
            <Link href="/dashboard/forms/new" className="btn btn-primary mt-4">Start your first form</Link>
          </div>
        )}
        <ul className="divide-y divide-probe-100">
          {data?.items.map((f) => (
            <li key={f.id} className="py-3">
              <Link href={`/dashboard/forms/${f.id}`} className="flex items-center justify-between hover:bg-probe-50 p-2 rounded-[2px]">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {f.title}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-probe-100 text-probe-700 uppercase">
                      {f.status}
                    </span>
                    <span className="text-xs text-probe-700">
                      {f.visibility}
                    </span>
                  </div>
                  <div className="text-xs text-probe-700">
                    /f/{f.slug} · {f.responseCount} responses · {formatRelative(f.updatedAt)}
                  </div>
                </div>
                <span className="text-probe-500">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
