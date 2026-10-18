"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import { nudgeChai } from "@/lib/chai";
import { trpc } from "@/lib/trpc";

import { FormTabs } from "../_components/form-tabs";

const PAGE_SIZE = 25;

type RespValue = { fieldId: string; value: unknown };
type Resp = {
  id: string;
  createdAt: string | Date;
  submitterEmail: string | null;
  submitterName: string | null;
  completionTime: number | null;
  values: RespValue[];
};
type Field = { id: string; label: string; type: string; config?: { options?: { label: string; value: string }[] } | null };

type FileValue = { key: string; name: string; size: number; type: string };

function isFileValue(v: unknown): v is FileValue {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as FileValue).key === "string" &&
    typeof (v as FileValue).name === "string"
  );
}

function valueToText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (isFileValue(v)) return v.name;
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function cell(v: unknown): string {
  const t = valueToText(v);
  return t === "" ? "—" : t;
}

/** Render a cell — file_upload values become a clickable download link. */
function renderCell(v: unknown, publicBaseUrl: string | null) {
  if (isFileValue(v) && publicBaseUrl) {
    const href = `${publicBaseUrl}/${v.key.replace(/^\/+/, "")}`;
    return (
      <a href={href} target="_blank" rel="noreferrer" className="text-probe-600 underline">
        {v.name}
      </a>
    );
  }
  return cell(v);
}
function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function fmtDuration(ms: number): string {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function buildDistributions(fields: Field[], items: Resp[]) {
  const out: { field: Field; entries: { label: string; count: number }[]; max: number }[] = [];
  for (const f of fields) {
    if (!["single_select", "multi_select", "rating"].includes(f.type)) continue;
    const counts = new Map<string, number>();
    for (const r of items) {
      const v = r.values.find((x) => x.fieldId === f.id)?.value;
      if (v === null || v === undefined || v === "") continue;
      for (const item of Array.isArray(v) ? v : [v]) {
        const key = String(item);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    if (counts.size === 0) continue;
    const optMap = new Map((f.config?.options ?? []).map((o) => [String(o.value), o.label]));
    const entries = [...counts.entries()]
      .map(([value, count]) => ({ label: optMap.get(value) ?? value, count }))
      .sort((a, b) => b.count - a.count);
    out.push({ field: f, entries, max: Math.max(...entries.map((e) => e.count)) });
  }
  return out;
}

export default function ResponsesPage() {
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fromIso = from ? new Date(from + "T00:00:00Z").toISOString() : undefined;
  const toIso = to ? new Date(to + "T23:59:59.999Z").toISOString() : undefined;

  const formQuery = trpc.forms.get.useQuery({ id });
  const analyticsQuery = trpc.forms.getAnalytics.useQuery({ id });
  const uploadsStatusQuery = trpc.uploads.status.useQuery();
  const responsesQuery = trpc.responses.list.useQuery({
    formId: id,
    limit: 100,
    from: fromIso,
    to: toIso,
  });

  const deleteMutation = trpc.responses.delete.useMutation({
    onSuccess: () => {
      utils.responses.list.invalidate();
      utils.forms.get.invalidate({ id });
      utils.forms.getAnalytics.invalidate({ id });
      toast.success("Response deleted");
    },
  });

  const fields = (formQuery.data?.fields ?? []) as Field[];
  const items = (responsesQuery.data?.items ?? []) as unknown as Resp[];
  const publicBaseUrl = uploadsStatusQuery.data?.publicBaseUrl ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items;
    if (q) {
      list = items.filter((r) => {
        const hay = [r.submitterEmail ?? "", r.submitterName ?? "", ...r.values.map((v) => valueToText(v.value))]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return [...list].sort((a, b) => {
      const t = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortAsc ? t : -t;
    });
  }, [items, search, sortAsc]);

  const distributions = useMemo(() => buildDistributions(fields, filtered), [fields, filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const exportUrl = (fmt: "csv" | "xlsx" | "pdf") => {
    const params = new URLSearchParams();
    if (fromIso) params.set("from", fromIso);
    if (toIso) params.set("to", toIso);
    const qs = params.toString();
    return `/forms/${id}/export.${fmt}${qs ? `?${qs}` : ""}`;
  };

  const resetFilters = () => {
    setFrom("");
    setTo("");
    setSearch("");
    setPage(0);
  };
  const hasFilters = Boolean(from || to || search);

  if (!formQuery.data) return <p className="text-probe-700">Loading…</p>;

  const a = analyticsQuery.data;
  const stats = [
    { label: "Responses", value: filtered.length, sub: hasFilters ? "filtered" : "all time" },
    { label: "Completion rate", value: a ? `${a.completionRate}%` : "—", sub: "starts → submits" },
    { label: "Avg. time", value: a ? fmtDuration(a.avgCompletionMs) : "—", sub: "to complete" },
    { label: "Views", value: a?.eventCounts.view ?? "—", sub: "total" },
  ];

  return (
    <div className="space-y-6">
      <FormTabs id={id} responseCount={formQuery.data.responseCount} />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs text-probe-700">
            <Link href={`/dashboard/forms/${id}`} className="hover:underline">
              {formQuery.data.title}
            </Link>
          </div>
          <h1 className="display text-3xl font-bold">Responses</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-probe-700">Export:</span>
          {(["csv", "xlsx", "pdf"] as const).map((fmt) => (
            <a
              key={fmt}
              href={exportUrl(fmt)}
              className="btn btn-ghost text-sm"
              // same-origin download; the route streams an attachment
              onClick={() => nudgeChai("Export ready — saved you a spreadsheet headache?")}
            >
              {fmt === "xlsx" ? "Excel" : fmt.toUpperCase()}
            </a>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <div className="text-xs uppercase tracking-wide text-probe-700">{s.label}</div>
            <div className="display text-2xl font-bold mt-1">{s.value}</div>
            <div className="text-xs text-probe-700 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="card flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <div className="text-xs text-probe-700 mb-1">From</div>
          <input
            type="date"
            className="input"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="text-sm">
          <div className="text-xs text-probe-700 mb-1">To</div>
          <input
            type="date"
            className="input"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="text-sm flex-1 min-w-[200px]">
          <div className="text-xs text-probe-700 mb-1">Search</div>
          <input
            type="search"
            className="input"
            placeholder="Search across all answers…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <button
          className="btn btn-ghost text-sm"
          onClick={() => setSortAsc((v) => !v)}
          title="Toggle sort order"
        >
          {sortAsc ? "Oldest first" : "Newest first"}
        </button>
        {hasFilters && (
          <button className="btn btn-ghost text-sm" onClick={resetFilters}>
            Clear
          </button>
        )}
      </div>

      {/* Per-field summaries */}
      {distributions.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3">
          {distributions.map(({ field, entries, max }) => (
            <div key={field.id} className="card">
              <div className="font-semibold text-sm mb-3">{field.label}</div>
              <div className="space-y-2">
                {entries.map((e) => (
                  <div key={e.label} className="text-sm">
                    <div className="flex justify-between mb-0.5">
                      <span className="truncate pr-2">{e.label}</span>
                      <span className="text-probe-700 tabular-nums">{e.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-probe-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-probe-500"
                        style={{ width: `${max > 0 ? (e.count / max) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Responses table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-probe-200 text-xs uppercase text-probe-700">
              <th className="text-left p-2 whitespace-nowrap">When</th>
              <th className="text-left p-2">Email</th>
              {fields.slice(0, 4).map((f) => (
                <th key={f.id} className="text-left p-2">
                  {f.label}
                </th>
              ))}
              <th className="text-right p-2" />
            </tr>
          </thead>
          <tbody>
            {pageItems.map((r) => {
              const byField = new Map(r.values.map((v) => [v.fieldId, v.value]));
              const isOpen = expanded === r.id;
              return (
                <Fragment key={r.id}>
                  <tr
                    className="border-b border-probe-100 hover:bg-probe-50/60 cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                  >
                    <td className="p-2 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                    <td className="p-2 whitespace-nowrap">{r.submitterEmail ?? "—"}</td>
                    {fields.slice(0, 4).map((f) => (
                      <td key={f.id} className="p-2 max-w-xs truncate">
                        {renderCell(byField.get(f.id), publicBaseUrl)}
                      </td>
                    ))}
                    <td className="p-2 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this response?")) deleteMutation.mutate({ id: r.id });
                        }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-probe-50/60 border-b border-probe-100">
                      <td colSpan={fields.slice(0, 4).length + 3} className="p-4">
                        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                          {fields.map((f) => (
                            <div key={f.id} className="flex flex-col">
                              <dt className="text-xs uppercase text-probe-700">{f.label}</dt>
                              <dd className="break-words">{renderCell(byField.get(f.id), publicBaseUrl)}</dd>
                            </div>
                          ))}
                          {r.completionTime != null && (
                            <div className="flex flex-col">
                              <dt className="text-xs uppercase text-probe-700">Time to complete</dt>
                              <dd>{fmtDuration(r.completionTime)}</dd>
                            </div>
                          )}
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p className="text-center text-probe-700 py-12">
            {hasFilters ? "No responses match these filters." : "No responses yet."}
          </p>
        )}

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-probe-100 text-sm">
            <span className="text-probe-700">
              {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-2">
              <button
                className="btn btn-ghost text-sm"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Prev
              </button>
              <button
                className="btn btn-ghost text-sm"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
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
