"use client";

import { toast } from "sonner";

import { trpc } from "@/lib/trpc";

export function IntegrationsAdmin() {
  const utils = trpc.useUtils();
  const query = trpc.integrations.adminList.useQuery(undefined, { retry: false });

  const setEnabled = trpc.integrations.adminSetEnabled.useMutation({
    onSuccess: (r) => {
      utils.integrations.adminList.invalidate();
      toast.success(`${r.key} ${r.enabled ? "enabled" : "disabled"}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const items = query.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="display text-xl font-bold">Integrations</h2>
        <p className="text-probe-700 text-sm mt-1">
          Platform-wide feature flags. When an integration is unavailable, set the
          required environment variables and restart to enable it.
        </p>
      </div>

      <div className="card overflow-x-auto">
        {query.isLoading && <p className="text-probe-700 py-4">Loading…</p>}
        {query.isError && (
          <p className="text-red-600 py-4">
            Failed to load integrations: {query.error.message}
          </p>
        )}

        {!query.isLoading && !query.isError && (
          <div className="divide-y divide-probe-100">
            {items.map((it) => (
              <div
                key={it.key}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{it.name}</div>
                  {it.available ? (
                    <div className="text-xs text-probe-700">
                      {it.enabled
                        ? "Enabled — form owners can connect it."
                        : "Available but disabled."}
                    </div>
                  ) : (
                    <div className="text-xs text-amber-700">
                      Configure {it.requiredEnv.join(" and ")} to enable
                    </div>
                  )}
                </div>

                {it.available ? (
                  <button
                    type="button"
                    className={`btn text-sm ${it.enabled ? "btn-ghost" : "btn-primary"}`}
                    disabled={setEnabled.isPending}
                    onClick={() =>
                      setEnabled.mutate({ key: it.key, enabled: !it.enabled })
                    }
                  >
                    {it.enabled ? "Disable" : "Enable"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost text-sm opacity-40 cursor-not-allowed"
                    disabled
                    title={`Configure ${it.requiredEnv.join(" and ")} to enable`}
                  >
                    Unavailable
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
