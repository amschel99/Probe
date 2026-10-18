"use client";

import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";

import type { FormStatus, FormVisibility } from "./types";

const PAGE_SIZE = 20;

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AdminForms() {
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FormStatus | "">("");
  const [visibility, setVisibility] = useState<FormVisibility | "">("");
  const [page, setPage] = useState(1);

  const query = trpc.admin.listForms.useQuery({
    search: search.trim() || undefined,
    status: status || undefined,
    visibility: visibility || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const invalidate = () => {
    utils.admin.listForms.invalidate();
    utils.admin.getStats.invalidate();
  };

  const setStatusMutation = trpc.admin.setFormStatus.useMutation({
    onSuccess: (_d, v) => {
      invalidate();
      toast.success(`Status set to ${v.status}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const setVisibilityMutation = trpc.admin.setFormVisibility.useMutation({
    onSuccess: (_d, v) => {
      invalidate();
      toast.success(`Visibility set to ${v.visibility}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.admin.deleteForm.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Form deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const busy =
    setStatusMutation.isPending ||
    setVisibilityMutation.isPending ||
    deleteMutation.isPending;

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setVisibility("");
    setPage(1);
  };
  const hasFilters = Boolean(search || status || visibility);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="card flex flex-wrap items-end gap-3">
        <label className="text-sm flex-1 min-w-[200px]">
          <div className="text-xs text-probe-700 mb-1">Search</div>
          <input
            type="search"
            className="input"
            placeholder="Search by title or slug…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="text-sm">
          <div className="text-xs text-probe-700 mb-1">Status</div>
          <select
            className="input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as FormStatus | "");
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="text-sm">
          <div className="text-xs text-probe-700 mb-1">Visibility</div>
          <select
            className="input"
            value={visibility}
            onChange={(e) => {
              setVisibility(e.target.value as FormVisibility | "");
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
          </select>
        </label>
        {hasFilters && (
          <button className="btn btn-ghost text-sm" onClick={resetFilters}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        {query.isLoading && <p className="text-probe-700 py-4">Loading…</p>}
        {query.isError && (
          <p className="text-red-600 py-4">Failed to load forms: {query.error.message}</p>
        )}

        {!query.isLoading && !query.isError && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-probe-200 text-xs uppercase text-probe-700">
                <th className="text-left p-2">Title</th>
                <th className="text-left p-2">Owner</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Visibility</th>
                <th className="text-right p-2">Responses</th>
                <th className="text-left p-2 whitespace-nowrap">Created</th>
                <th className="text-right p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id} className="border-b border-probe-100 hover:bg-probe-50/60">
                  <td className="p-2">
                    <div className="font-semibold">{f.title}</div>
                    <div className="text-xs text-probe-700">/f/{f.slug}</div>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <div>{f.ownerName || "—"}</div>
                    <div className="text-xs text-probe-700">{f.ownerEmail}</div>
                  </td>
                  <td className="p-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-probe-100 text-probe-700 uppercase">
                      {f.status}
                    </span>
                  </td>
                  <td className="p-2 capitalize">{f.visibility}</td>
                  <td className="p-2 text-right tabular-nums">{f.responseCount}</td>
                  <td className="p-2 whitespace-nowrap">{fmtDate(f.createdAt)}</td>
                  <td className="p-2">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <select
                        className="input !py-1 !px-2 text-xs w-auto"
                        value={f.status}
                        disabled={busy}
                        onChange={(e) =>
                          setStatusMutation.mutate({
                            formId: f.id,
                            status: e.target.value as FormStatus,
                          })
                        }
                        title="Change status"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>
                      <button
                        className="btn btn-ghost text-xs !py-1 !px-2"
                        disabled={busy}
                        onClick={() =>
                          setVisibilityMutation.mutate({
                            formId: f.id,
                            visibility: f.visibility === "public" ? "unlisted" : "public",
                          })
                        }
                        title="Toggle visibility"
                      >
                        Make {f.visibility === "public" ? "unlisted" : "public"}
                      </button>
                      <button
                        className="text-xs text-red-600 hover:underline disabled:opacity-40"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              `Delete "${f.title}"? This removes its fields, responses and analytics. This cannot be undone.`,
                            )
                          ) {
                            deleteMutation.mutate({ formId: f.id });
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!query.isLoading && !query.isError && items.length === 0 && (
          <p className="text-center text-probe-700 py-12">
            {hasFilters ? "No forms match these filters." : "No forms yet."}
          </p>
        )}

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-probe-100 text-sm">
            <span className="text-probe-700">
              Page {page} of {pageCount} · {total} total
            </span>
            <div className="flex gap-2">
              <button
                className="btn btn-ghost text-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                className="btn btn-ghost text-sm"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
