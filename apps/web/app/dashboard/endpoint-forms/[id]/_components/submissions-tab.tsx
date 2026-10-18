"use client";

import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { formatRelative } from "@/lib/utils";

type Payload = Record<string, unknown>;

/** "first_name" / "firstName" / "first-name" → "First name". */
function humanize(key: string): string {
  const spaced = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function toText(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (Array.isArray(v)) return v.map(toText).join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/\S+$/;

function Value({ v }: { v: unknown }) {
  const text = toText(v);
  if (!text) return <span className="text-probe-700">—</span>;
  if (EMAIL_RE.test(text)) {
    return (
      <a href={`mailto:${text}`} className="underline">
        {text}
      </a>
    );
  }
  if (URL_RE.test(text)) {
    return (
      <a href={text} target="_blank" rel="noreferrer" className="underline break-all">
        {text}
      </a>
    );
  }
  return <span className="whitespace-pre-wrap break-words">{text}</span>;
}

export function SubmissionsTab({ formId }: { formId: string }) {
  const utils = trpc.useUtils();
  const query = trpc.responses.list.useInfiniteQuery(
    { formId, limit: 50 },
    { getNextPageParam: (last) => last.nextCursor ?? undefined },
  );
  const deleteMutation = trpc.responses.delete.useMutation({
    onSuccess: () => {
      toast("Submission deleted");
      setOpenId(null);
      utils.responses.list.invalidate({ formId });
    },
    onError: (e) => toast.error(e.message),
  });
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  // One column per payload key, in first-seen order (matches the CSV export).
  const columns = useMemo(() => {
    const seen = new Set<string>();
    for (const r of items) for (const k of Object.keys((r.payload ?? {}) as Payload)) seen.add(k);
    return [...seen];
  }, [items]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) =>
      Object.values((r.payload ?? {}) as Payload).some((v) => toText(v).toLowerCase().includes(q)),
    );
  }, [items, search]);

  if (query.isLoading) return <div className="card text-probe-700">Loading…</div>;
  if (items.length === 0) {
    return (
      <div className="card text-probe-700">
        No submissions yet. Paste the snippet into your site and send a test.
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold mr-auto">
          {rows.length === items.length ? `${items.length}` : `${rows.length} of ${items.length}`}
          {query.hasNextPage ? "+" : ""} submission{items.length === 1 ? "" : "s"}
          {search && query.hasNextPage && (
            <span className="font-normal text-probe-700"> (searching loaded only)</span>
          )}
        </div>
        <input
          className="input w-56 text-sm"
          placeholder="Search submissions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <a className="btn btn-ghost text-sm" href={`/forms/${formId}/export.csv`}>
          CSV
        </a>
        <a className="btn btn-ghost text-sm" href={`/forms/${formId}/export.xlsx`}>
          Excel
        </a>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-probe-200 text-left text-xs uppercase text-probe-700">
              <th className="px-2 py-2 font-semibold whitespace-nowrap">Received</th>
              {columns.map((c) => (
                <th key={c} className="px-2 py-2 font-semibold whitespace-nowrap">
                  {humanize(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const payload = (r.payload ?? {}) as Payload;
              const open = openId === r.id;
              return (
                <Fragment key={r.id}>
                  <tr
                    onClick={() => setOpenId(open ? null : r.id)}
                    className={`cursor-pointer border-b border-probe-100 hover:bg-probe-50 ${
                      open ? "bg-probe-50" : ""
                    }`}
                  >
                    <td className="px-2 py-2 whitespace-nowrap text-probe-700">
                      {formatRelative(r.createdAt)}
                      {r.spamFlagged && <span className="ml-1 text-red-700">⚠</span>}
                    </td>
                    {columns.map((c) => (
                      <td key={c} className="px-2 py-2 max-w-[16rem] truncate">
                        {toText(payload[c]) || <span className="text-probe-700">—</span>}
                      </td>
                    ))}
                  </tr>
                  {open && (
                    <tr className="bg-probe-50">
                      <td colSpan={columns.length + 1} className="px-2 pb-4">
                        <dl className="grid sm:grid-cols-[12rem_1fr] gap-x-4 gap-y-2 rounded-lg border border-probe-200 bg-white p-4">
                          {Object.keys(payload).map((k) => (
                            <Fragment key={k}>
                              <dt className="text-xs font-semibold uppercase text-probe-700 pt-0.5">
                                {humanize(k)}
                              </dt>
                              <dd>
                                <Value v={payload[k]} />
                              </dd>
                            </Fragment>
                          ))}
                          <dt className="text-xs font-semibold uppercase text-probe-700 pt-0.5">
                            Received
                          </dt>
                          <dd className="text-probe-700">
                            {new Date(r.createdAt).toLocaleString()}
                          </dd>
                        </dl>
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            className="text-xs text-red-700 hover:underline"
                            disabled={deleteMutation.isPending}
                            onClick={() =>
                              confirm("Delete this submission?") &&
                              deleteMutation.mutate({ id: r.id })
                            }
                          >
                            Delete submission
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {query.hasNextPage && (
        <div className="flex justify-center">
          <button
            type="button"
            className="btn btn-ghost text-sm"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
