"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";

type ProviderId =
  | "anthropic"
  | "openai"
  | "deepseek"
  | "gemini"
  | "openrouter"
  | "groq"
  | "mistral"
  | "custom";

export function AiProviderCard({ isAdmin }: { isAdmin: boolean }) {
  const utils = trpc.useUtils();
  const status = trpc.ai.status.useQuery();
  const [provider, setProvider] = useState<ProviderId>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [editing, setEditing] = useState(false);

  const providers = (status.data?.providers ?? []).filter((p) => p.id !== "custom" || isAdmin);
  const info = providers.find((p) => p.id === provider);

  // Start the form on whatever the user already has saved.
  useEffect(() => {
    if (status.data?.source === "user" && status.data.provider) {
      setProvider(status.data.provider as ProviderId);
      setBaseUrl(status.data.baseUrl ?? "");
    }
  }, [status.data?.source, status.data?.provider, status.data?.baseUrl]);

  const save = trpc.ai.setKey.useMutation({
    onSuccess: () => {
      toast.success("AI connected. You can generate forms now.");
      setApiKey("");
      setEditing(false);
      utils.ai.status.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const clear = trpc.ai.clearKey.useMutation({
    onSuccess: () => {
      toast("AI settings removed");
      utils.ai.status.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const ownKey = status.data?.source === "user";
  const showForm = editing || !ownKey;
  const canSave =
    provider === "custom" ? baseUrl.trim() && model.trim() : apiKey.trim().length >= 8;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold">AI form generation</h3>
        {status.data?.hasKey && (
          <span className="border border-probe-900 px-2 py-0.5 font-mono text-[11px]">
            {status.data.providerLabel} · {status.data.model}
          </span>
        )}
      </div>
      <p className="text-sm text-probe-700">
        Describe a form in plain words and AI drafts the questions. Bring a key from any
        provider: Claude, OpenAI, DeepSeek, Gemini, Groq, Mistral or OpenRouter. Keys are
        stored encrypted and only used to draft your forms.
      </p>

      {status.data?.source === "instance" && (
        <p className="border border-probe-200 bg-probe-100 px-3 py-2 text-sm">
          This server already provides AI ({status.data.providerLabel}). Add your own key only
          if you want to use a different provider or model.
        </p>
      )}

      {ownKey && !editing && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-ghost text-sm" onClick={() => setEditing(true)}>
            Change provider or key
          </button>
          <button
            type="button"
            className="btn btn-ghost text-sm"
            onClick={() => clear.mutate()}
            disabled={clear.isPending}
          >
            {clear.isPending ? "Removing…" : "Remove"}
          </button>
        </div>
      )}

      {showForm && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({
              provider,
              apiKey: apiKey.trim() || undefined,
              model: model.trim() || undefined,
              baseUrl: provider === "custom" ? baseUrl.trim() || undefined : undefined,
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ai-provider">
                Provider
              </label>
              <select
                id="ai-provider"
                className="input"
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value as ProviderId);
                  setModel("");
                }}
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ai-model">
                Model
              </label>
              <input
                id="ai-model"
                className="input font-mono text-[13px]"
                placeholder={info?.defaultModel || "e.g. llama3.1"}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          {provider === "custom" && (
            <div>
              <label className="label" htmlFor="ai-base">
                Base URL
              </label>
              <input
                id="ai-base"
                className="input font-mono text-[13px]"
                placeholder="http://localhost:11434/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                autoComplete="off"
              />
              <p className="help">Any OpenAI-compatible endpoint, such as Ollama or LM Studio.</p>
            </div>
          )}

          <div>
            <label className="label" htmlFor="ai-key">
              API key{provider === "custom" && " (optional)"}
            </label>
            <input
              id="ai-key"
              className="input font-mono text-[13px]"
              type="password"
              placeholder="Paste your key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
            {info?.keyUrl && (
              <p className="help">
                Get one at{" "}
                <a href={info.keyUrl} target="_blank" rel="noreferrer" className="underline">
                  {new URL(info.keyUrl).hostname}
                </a>
                . Leave the model blank to use {info.defaultModel}.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary text-sm" disabled={!canSave || save.isPending}>
              {save.isPending ? "Checking key…" : "Save"}
            </button>
            {editing && (
              <button type="button" className="btn btn-ghost text-sm" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
