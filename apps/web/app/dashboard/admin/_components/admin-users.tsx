"use client";

import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";

const PAGE_SIZE = 20;

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AdminUsers({ currentUserId }: { currentUserId: string | undefined }) {
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const query = trpc.admin.listUsers.useQuery({
    search: search.trim() || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const setRoleMutation = trpc.admin.setUserRole.useMutation({
    onSuccess: (u) => {
      utils.admin.listUsers.invalidate();
      utils.admin.getStats.invalidate();
      toast.success(`${u.email} is now ${u.role}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="card flex flex-wrap items-end gap-3">
        <label className="text-sm flex-1 min-w-[200px]">
          <div className="text-xs text-probe-700 mb-1">Search</div>
          <input
            type="search"
            className="input"
            placeholder="Search by email or name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        {search && (
          <button
            className="btn btn-ghost text-sm"
            onClick={() => {
              setSearch("");
              setPage(1);
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        {query.isLoading && <p className="text-probe-700 py-4">Loading…</p>}
        {query.isError && (
          <p className="text-red-600 py-4">Failed to load users: {query.error.message}</p>
        )}

        {!query.isLoading && !query.isError && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-probe-200 text-xs uppercase text-probe-700">
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Role</th>
                <th className="text-left p-2">Verified</th>
                <th className="text-right p-2">Forms</th>
                <th className="text-left p-2 whitespace-nowrap">Joined</th>
                <th className="text-right p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => {
                const isSelf = u.id === currentUserId;
                const isAdmin = u.role === "admin";
                return (
                  <tr key={u.id} className="border-b border-probe-100 hover:bg-probe-50/60">
                    <td className="p-2">
                      {u.email}
                      {isSelf && <span className="text-xs text-probe-500 ml-1">(you)</span>}
                    </td>
                    <td className="p-2">{u.name || "—"}</td>
                    <td className="p-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full uppercase ${
                          isAdmin
                            ? "bg-probe-500 text-white"
                            : "bg-probe-100 text-probe-700"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-2">{u.emailVerified ? "Yes" : "No"}</td>
                    <td className="p-2 text-right tabular-nums">{u.formCount}</td>
                    <td className="p-2 whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                    <td className="p-2 text-right">
                      <button
                        className="btn btn-ghost text-xs !py-1 !px-2 disabled:opacity-40"
                        disabled={isSelf || setRoleMutation.isPending}
                        title={
                          isSelf
                            ? "You can't change your own role"
                            : isAdmin
                              ? "Demote to user"
                              : "Promote to admin"
                        }
                        onClick={() =>
                          setRoleMutation.mutate({
                            userId: u.id,
                            role: isAdmin ? "user" : "admin",
                          })
                        }
                      >
                        {isAdmin ? "Demote" : "Promote"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!query.isLoading && !query.isError && items.length === 0 && (
          <p className="text-center text-probe-700 py-12">
            {search ? "No users match your search." : "No users yet."}
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
