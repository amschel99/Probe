"use client";

import { toast } from "sonner";

import { trpc } from "@/lib/trpc";

import { AiProviderCard } from "./_components/ai-provider-card";
import { ApiKeysCard } from "./_components/api-keys-card";

export default function SettingsPage() {
  const meQuery = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  // Google Sheets connection (for the Sheets response integration).
  const googleStatus = trpc.integrations.googleStatus.useQuery();
  const googleAuthUrl = trpc.integrations.googleAuthUrl.useQuery(undefined, {
    enabled: googleStatus.data?.available && !googleStatus.data?.connected,
    retry: false,
  });
  const googleDisconnect = trpc.integrations.googleDisconnect.useMutation({
    onSuccess: () => {
      toast("Google disconnected");
      utils.integrations.googleStatus.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="display text-3xl font-bold">Settings</h1>

      <div className="card space-y-2">
        <div className="text-xs uppercase font-bold text-probe-700">Account</div>
        <div>
          <div className="label">Name</div>
          <input className="input" defaultValue={meQuery.data?.name ?? ""} disabled />
        </div>
        <div>
          <div className="label">Email</div>
          <input className="input" defaultValue={meQuery.data?.email ?? ""} disabled />
        </div>
        <p className="help">Profile editing coming soon. Open an issue if you need it.</p>
      </div>

      <AiProviderCard isAdmin={meQuery.data?.role === "admin"} />

      {/* Google Sheets — connect a Google account for the Sheets integration */}
      {googleStatus.data?.available && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Google Sheets</h3>
            {googleStatus.data?.connected && (
              <span className="text-xs font-semibold text-green-700 bg-green-50 rounded-full px-2.5 py-0.5">
                Connected
              </span>
            )}
          </div>
          <p className="text-sm text-probe-700">
            Connect a Google account so forms can append each response to a spreadsheet.
            Tokens are stored encrypted and used only for the Sheets integration.
          </p>
          {googleStatus.data?.connected ? (
            <div className="flex items-center gap-3">
              <input
                className="input flex-1"
                value={googleStatus.data.email ?? "Connected"}
                disabled
              />
              <button
                type="button"
                className="btn btn-ghost text-sm"
                onClick={() => googleDisconnect.mutate()}
                disabled={googleDisconnect.isPending}
              >
                {googleDisconnect.isPending ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          ) : (
            <a
              className={`btn btn-primary text-sm ${googleAuthUrl.data?.url ? "" : "opacity-40 pointer-events-none"}`}
              href={googleAuthUrl.data?.url ?? "#"}
            >
              Connect Google
            </a>
          )}
        </div>
      )}

      <ApiKeysCard />
    </div>
  );
}
