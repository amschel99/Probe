"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";

/**
 * Builder-side integrations panel. Renders only the integrations that are
 * platform-enabled for this deployment. Discord → webhook URL; Sheets → connect
 * Google, then spreadsheet id + sheet name.
 */
export function IntegrationsPanel({ formId }: { formId: string }) {
  const enabledQuery = trpc.integrations.listEnabled.useQuery();
  const enabled = enabledQuery.data ?? [];

  if (enabledQuery.isLoading) return null;
  if (enabled.length === 0) return null;

  return (
    <div className="card space-y-4">
      <div>
        <div className="text-xs font-bold uppercase text-probe-700">Integrations</div>
        <p className="text-xs text-probe-700 mt-1">
          Forward each new response to your tools. Delivery is best-effort and never
          blocks submissions.
        </p>
      </div>
      {enabled.some((e) => e.key === "discord") && (
        <DiscordIntegration formId={formId} />
      )}
      {enabled.some((e) => e.key === "sheets") && <SheetsIntegration formId={formId} />}
    </div>
  );
}

function useFormIntegrations(formId: string) {
  const utils = trpc.useUtils();
  const query = trpc.integrations.listForForm.useQuery({ formId });
  const invalidate = () => utils.integrations.listForForm.invalidate({ formId });
  return { query, invalidate };
}

function DiscordIntegration({ formId }: { formId: string }) {
  const { query, invalidate } = useFormIntegrations(formId);
  const existing = query.data?.find((i) => i.type === "discord");
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    const cfg = existing?.config as { webhookUrl?: string } | undefined;
    setWebhookUrl(cfg?.webhookUrl ?? "");
  }, [existing]);

  const upsert = trpc.integrations.upsertForForm.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Discord integration saved");
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.integrations.deleteForForm.useMutation({
    onSuccess: () => {
      invalidate();
      toast("Discord integration removed");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="border-t border-probe-100 pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm">Discord</div>
        {existing && (
          <span className="text-xs font-semibold text-green-700 bg-green-50 rounded-full px-2 py-0.5">
            Connected
          </span>
        )}
      </div>
      <label className="label text-sm">Webhook URL</label>
      <input
        className="input text-sm"
        type="url"
        placeholder="https://discord.com/api/webhooks/…"
        value={webhookUrl}
        onChange={(e) => setWebhookUrl(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary text-sm"
          disabled={upsert.isPending || webhookUrl.trim().length < 8}
          onClick={() =>
            upsert.mutate({
              formId,
              type: "discord",
              config: { webhookUrl: webhookUrl.trim() },
            })
          }
        >
          {upsert.isPending ? "Saving…" : "Save"}
        </button>
        {existing && (
          <button
            type="button"
            className="btn btn-ghost text-sm"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ formId, type: "discord" })}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function SheetsIntegration({ formId }: { formId: string }) {
  const { query, invalidate } = useFormIntegrations(formId);
  const existing = query.data?.find((i) => i.type === "sheets");
  const googleStatus = trpc.integrations.googleStatus.useQuery();
  const authUrl = trpc.integrations.googleAuthUrl.useQuery(undefined, {
    enabled: !googleStatus.data?.connected,
    retry: false,
  });

  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetName, setSheetName] = useState("Sheet1");

  useEffect(() => {
    const cfg = existing?.config as
      | { spreadsheetId?: string; sheetName?: string }
      | undefined;
    if (cfg) {
      setSpreadsheetId(cfg.spreadsheetId ?? "");
      setSheetName(cfg.sheetName ?? "Sheet1");
    }
  }, [existing]);

  const upsert = trpc.integrations.upsertForForm.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Google Sheets integration saved");
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.integrations.deleteForForm.useMutation({
    onSuccess: () => {
      invalidate();
      toast("Google Sheets integration removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const connected = googleStatus.data?.connected;

  return (
    <div className="border-t border-probe-100 pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm">Google Sheets</div>
        {existing && (
          <span className="text-xs font-semibold text-green-700 bg-green-50 rounded-full px-2 py-0.5">
            Connected
          </span>
        )}
      </div>

      {!connected ? (
        <div className="space-y-2">
          <p className="text-xs text-probe-700">
            Connect your Google account to append responses to a spreadsheet.
          </p>
          <a
            className={`btn btn-primary text-sm ${authUrl.data?.url ? "" : "opacity-40 pointer-events-none"}`}
            href={authUrl.data?.url ?? "#"}
          >
            Connect Google
          </a>
        </div>
      ) : (
        <>
          <p className="text-xs text-probe-700">
            Connected as {googleStatus.data?.email ?? "your Google account"}.
          </p>
          <label className="label text-sm">Spreadsheet ID</label>
          <input
            className="input text-sm"
            placeholder="1AbC…the long id from the sheet URL"
            value={spreadsheetId}
            onChange={(e) => setSpreadsheetId(e.target.value)}
          />
          <label className="label text-sm">Sheet (tab) name</label>
          <input
            className="input text-sm"
            placeholder="Sheet1"
            value={sheetName}
            onChange={(e) => setSheetName(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary text-sm"
              disabled={
                upsert.isPending ||
                spreadsheetId.trim().length < 1 ||
                sheetName.trim().length < 1
              }
              onClick={() =>
                upsert.mutate({
                  formId,
                  type: "sheets",
                  config: {
                    spreadsheetId: spreadsheetId.trim(),
                    sheetName: sheetName.trim(),
                  },
                })
              }
            >
              {upsert.isPending ? "Saving…" : "Save"}
            </button>
            {existing && (
              <button
                type="button"
                className="btn btn-ghost text-sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate({ formId, type: "sheets" })}
              >
                Remove
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
