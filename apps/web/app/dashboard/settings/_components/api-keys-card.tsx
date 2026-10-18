"use client";

import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";

export function ApiKeysCard() {
  const utils = trpc.useUtils();
  const keysQuery = trpc.apiKeys.list.useQuery();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);

  const create = trpc.apiKeys.create.useMutation({
    onSuccess: (row) => {
      setCreated(row.key);
      setName("");
      utils.apiKeys.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const revoke = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => {
      toast("API key revoked");
      utils.apiKeys.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <div className="card space-y-3">
      <h3 className="font-bold">API keys</h3>
      <p className="text-sm text-probe-700">
        Let agents and scripts use the API as you — create forms, add fields, read responses.
        Send <code>Authorization: Bearer &lt;key&gt;</code>. Instructions for agents:{" "}
        <a href="/llms.txt" target="_blank" rel="noreferrer" className="underline">
          /llms.txt
        </a>
        .
      </p>

      {created && (
        <div className="rounded-lg border border-probe-200 bg-probe-50 p-3 space-y-2">
          <div className="text-sm font-semibold">
            Copy your new key now — it won&apos;t be shown again.
          </div>
          <div className="flex items-center gap-2">
            <input className="input flex-1 font-mono text-xs" value={created} readOnly />
            <button type="button" className="btn btn-primary text-sm" onClick={() => copy(created)}>
              Copy
            </button>
          </div>
          <button type="button" className="text-xs underline" onClick={() => setCreated(null)}>
            Done
          </button>
        </div>
      )}

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ name });
        }}
      >
        <input
          className="input flex-1"
          placeholder="Key name, e.g. My agent"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
        <button
          type="submit"
          className="btn btn-primary text-sm"
          disabled={create.isPending || name.trim().length === 0}
        >
          {create.isPending ? "Creating…" : "Create key"}
        </button>
      </form>

      {keysQuery.data && keysQuery.data.length > 0 && (
        <ul className="divide-y divide-probe-100 text-sm">
          {keysQuery.data.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{k.name}</div>
                <div className="text-xs text-probe-700 font-mono">
                  {k.prefix}… · created {new Date(k.createdAt).toLocaleDateString()} ·{" "}
                  {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleString()}` : "never used"}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost text-sm"
                onClick={() => {
                  if (confirm(`Revoke "${k.name}"? Agents using it will stop working.`)) {
                    revoke.mutate({ id: k.id });
                  }
                }}
                disabled={revoke.isPending}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
