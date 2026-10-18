"use client";

import Link from "next/link";

import { trpc } from "@/lib/trpc";
import { formatRelative } from "@/lib/utils";

export default function DashboardHome() {
  const formsQuery = trpc.forms.list.useQuery({ limit: 5 });
  const endpointsQuery = trpc.endpoint.list.useQuery({ limit: 5 });

  const totalResponses =
    (formsQuery.data?.items.reduce((sum, f) => sum + f.responseCount, 0) ?? 0) +
    (endpointsQuery.data?.items.reduce((sum, f) => sum + f.responseCount, 0) ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-3xl font-bold">Welcome back 👋</h1>
        <p className="text-probe-700 mt-1">
          Two surfaces, one dashboard. Build forms, collect responses, ship.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Stat label="Hosted forms" value={formsQuery.data?.items.length ?? 0} />
        <Stat label="Endpoint forms" value={endpointsQuery.data?.items.length ?? 0} />
        <Stat label="Total responses" value={totalResponses} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="display text-xl font-bold">Recent hosted forms</h2>
            <Link href="/dashboard/forms/new" className="btn btn-primary text-sm">
              + New form
            </Link>
          </div>
          {formsQuery.data?.items.length === 0 && (
            <p className="text-sm text-probe-700">No forms yet. Make one.</p>
          )}
          <ul className="space-y-2">
            {formsQuery.data?.items.slice(0, 5).map((f) => (
              <li key={f.id}>
                <Link
                  href={`/dashboard/forms/${f.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-probe-50"
                >
                  <div>
                    <div className="font-semibold">{f.title}</div>
                    <div className="text-xs text-probe-700">
                      {f.status} · {f.responseCount} responses · {formatRelative(f.updatedAt)}
                    </div>
                  </div>
                  <span className="text-probe-500">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="display text-xl font-bold">Endpoint forms</h2>
            <Link href="/dashboard/endpoint-forms/new" className="btn btn-primary text-sm">
              + New endpoint
            </Link>
          </div>
          {endpointsQuery.data?.items.length === 0 && (
            <p className="text-sm text-probe-700">
              No endpoint forms yet. For client contact pages, this is what you want.
            </p>
          )}
          <ul className="space-y-2">
            {endpointsQuery.data?.items.slice(0, 5).map((f) => (
              <li key={f.id}>
                <Link
                  href={`/dashboard/endpoint-forms/${f.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-probe-50"
                >
                  <div>
                    <div className="font-semibold">
                      {f.title}{" "}
                      {!f.accessKeyVerifiedAt && (
                        <span className="text-xs text-probe-500 ml-1">(unverified)</span>
                      )}
                    </div>
                    <div className="text-xs text-probe-700">
                      {f.websiteUrl} · {f.responseCount} submissions
                    </div>
                  </div>
                  <span className="text-probe-500">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase font-semibold text-probe-700">{label}</div>
      <div className="display text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}
