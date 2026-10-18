"use client";

import Link from "next/link";

import { trpc } from "@/lib/trpc";
import { formatRelative } from "@/lib/utils";

export default function EndpointFormsListPage() {
  const { data, isLoading } = trpc.endpoint.list.useQuery({ limit: 50 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display text-3xl font-bold">Endpoint forms</h1>
          <p className="text-probe-700 mt-1">
            POST-to-an-endpoint forms for any HTML. Perfect for freelance client contact pages.
          </p>
        </div>
        <Link href="/dashboard/endpoint-forms/new" className="btn btn-primary">
          + New endpoint
        </Link>
      </div>

      <div className="card">
        {isLoading && <p className="text-probe-700">Loading…</p>}
        {!isLoading && data?.items.length === 0 && (
          <div className="text-center py-12">
            <div className="text-3xl mb-2 text-probe-500" aria-hidden>✦</div>
            <p className="text-probe-700">No endpoint forms yet.</p>
            <Link href="/dashboard/endpoint-forms/new" className="btn btn-primary mt-4">
              Create your first endpoint
            </Link>
          </div>
        )}
        <ul className="divide-y divide-probe-100">
          {data?.items.map((f) => (
            <li key={f.id} className="py-3">
              <Link href={`/dashboard/endpoint-forms/${f.id}`} className="flex items-center justify-between hover:bg-probe-50 p-2 rounded-lg">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {f.title}
                    {f.accessKeyVerifiedAt ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">verified</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">unverified</span>
                    )}
                  </div>
                  <div className="text-xs text-probe-700">
                    {f.websiteUrl} · → {f.recipientEmail} · {f.responseCount} submissions
                  </div>
                  <div className="text-xs text-probe-700">
                    Last: {formatRelative(f.lastSubmittedAt)}
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
