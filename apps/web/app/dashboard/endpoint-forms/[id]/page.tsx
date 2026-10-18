"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { formatRelative } from "@/lib/utils";

const TABS = ["snippet", "submissions", "settings", "security"] as const;
type Tab = (typeof TABS)[number];

export default function EndpointFormDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const formQuery = trpc.endpoint.get.useQuery({ id });
  const submissionsQuery = trpc.responses.list.useQuery({ formId: id, limit: 50 });

  const rotateMutation = trpc.endpoint.rotateKey.useMutation({
    onSuccess: () => {
      utils.endpoint.get.invalidate({ id });
      toast.success("New access key generated. Update your snippets.");
    },
  });
  const resendMutation = trpc.endpoint.resendVerification.useMutation({
    onSuccess: () => toast.success("Verification email sent"),
  });
  const updateMutation = trpc.endpoint.update.useMutation({
    onSuccess: () => {
      utils.endpoint.get.invalidate({ id });
      toast.success("Saved");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.endpoint.delete.useMutation({
    onSuccess: () => router.push("/dashboard/endpoint-forms"),
  });
  const auditQuery = trpc.endpoint.auditLog.useQuery({ id });

  const [tab, setTab] = useState<Tab>("snippet");
  if (!formQuery.data) return <p className="text-probe-700">Loading…</p>;

  const form = formQuery.data;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://probe.riftfi.com";
  const endpoint = `${origin}/submit`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-probe-700">
            <Link href="/dashboard/endpoint-forms" className="hover:underline">
              Endpoint forms
            </Link>{" "}
            / {form.title}
          </div>
          <div className="flex items-center gap-2">
            <h1 className="display text-3xl font-bold">{form.title}</h1>
            {form.accessKeyVerifiedAt ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">verified</span>
            ) : (
              <button
                onClick={() => resendMutation.mutate({ id })}
                className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
              >
                unverified · resend
              </button>
            )}
          </div>
          <p className="text-probe-700 text-sm">
            Submissions to {form.recipientEmail} from {form.websiteUrl}
          </p>
        </div>
        <button
          onClick={() => confirm("Delete this endpoint?") && deleteMutation.mutate({ id })}
          className="text-sm text-red-700 hover:underline"
        >
          Delete
        </button>
      </div>

      <div className="flex gap-2 border-b border-probe-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 ${
              tab === t
                ? "border-probe-500 text-probe-900"
                : "border-transparent text-probe-700 hover:text-probe-900"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "snippet" && (
        <div className="space-y-4">
          <div className="card">
            <div className="text-xs font-bold uppercase text-probe-700 mb-1">Endpoint URL</div>
            <code className="block bg-probe-900 text-probe-50 p-3 rounded-lg text-xs">{endpoint}</code>
          </div>
          <div className="card">
            <div className="text-xs font-bold uppercase text-probe-700 mb-1">Access key (public)</div>
            <code className="block bg-probe-900 text-probe-50 p-3 rounded-lg text-xs">
              {form.accessKey}
            </code>
            <p className="help">
              This key is public — it&apos;s in your client-side HTML. Defense comes from origin allowlist,
              honeypot, captcha, and rate limits.
            </p>
          </div>

          <SnippetTabs endpoint={endpoint} accessKey={form.accessKey!} />
        </div>
      )}

      {tab === "submissions" && (
        <div className="card">
          {submissionsQuery.data?.items.length === 0 && (
            <p className="text-probe-700">No submissions yet.</p>
          )}
          <ul className="space-y-2">
            {submissionsQuery.data?.items.map((r) => (
              <li key={r.id} className="border border-probe-200 rounded-lg p-3">
                <div className="text-xs text-probe-700 mb-1">
                  {formatRelative(r.createdAt)}
                  {r.submitterEmail && <> · from {r.submitterEmail}</>}
                  {r.spamFlagged && (
                    <span className="ml-2 text-red-700">⚠ flagged</span>
                  )}
                </div>
                <pre className="text-xs bg-probe-50 p-2 rounded">
                  {JSON.stringify(r.payload, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "settings" && (
        <SettingsTab
          form={form}
          onSave={(patch) => updateMutation.mutate({ id, ...patch })}
        />
      )}

      {tab === "security" && (
        <div className="space-y-4">
          <div className="card flex items-center justify-between">
            <div>
              <div className="font-bold">Rotate access key</div>
              <p className="text-sm text-probe-700">
                Old key becomes invalid immediately. Update your snippets after rotation.
              </p>
            </div>
            <button
              onClick={() => confirm("Rotate the access key?") && rotateMutation.mutate({ id })}
              className="btn btn-ghost"
            >
              Rotate
            </button>
          </div>
          <div className="card">
            <h3 className="font-bold mb-3">Audit log</h3>
            <ul className="text-sm space-y-2">
              {auditQuery.data?.map((row) => (
                <li key={row.id} className="flex justify-between border-b border-probe-100 pb-2">
                  <div>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-probe-100">
                      {row.action}
                    </span>
                    <span className="ml-2 text-probe-700">
                      {row.detail ? JSON.stringify(row.detail) : ""}
                    </span>
                  </div>
                  <div className="text-xs text-probe-700">{formatRelative(row.createdAt)}</div>
                </li>
              ))}
              {auditQuery.data?.length === 0 && (
                <li className="text-probe-700">No audit events yet.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function SnippetTabs({ endpoint, accessKey }: { endpoint: string; accessKey: string }) {
  const [snippet, setSnippet] = useState<"html" | "fetch" | "react">("html");
  const html = `<form action="${endpoint}" method="POST">
  <input type="hidden" name="access_key" value="${accessKey}">
  <input type="checkbox" name="botcheck" style="display:none" tabindex="-1" autocomplete="off">

  <input name="name" required>
  <input name="email" type="email" required>
  <textarea name="message" required></textarea>

  <button type="submit">Send</button>
</form>`;
  const fetchSnippet = `await fetch("${endpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    access_key: "${accessKey}",
    name,
    email,
    message,
    botcheck: "",
  }),
});`;
  const react = `import { useState } from "react";

export function ContactForm() {
  const [sending, setSending] = useState(false);
  async function onSubmit(e) {
    e.preventDefault();
    setSending(true);
    const data = Object.fromEntries(new FormData(e.target));
    await fetch("${endpoint}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_key: "${accessKey}", ...data, botcheck: "" }),
    });
    setSending(false);
  }
  return (
    <form onSubmit={onSubmit}>
      <input name="name" required />
      <input name="email" type="email" required />
      <textarea name="message" required />
      <button disabled={sending}>{sending ? "Sending…" : "Send"}</button>
    </form>
  );
}`;
  const content = snippet === "html" ? html : snippet === "fetch" ? fetchSnippet : react;
  return (
    <div className="card">
      <div className="flex gap-2 mb-3">
        {(["html", "fetch", "react"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSnippet(s)}
            className={`px-3 py-1 rounded-lg text-sm ${
              snippet === s ? "bg-probe-900 text-white" : "bg-probe-100 text-probe-900"
            }`}
          >
            {s.toUpperCase()}
          </button>
        ))}
        <button
          onClick={() => {
            navigator.clipboard.writeText(content);
            toast.success("Copied");
          }}
          className="ml-auto text-sm btn btn-ghost"
        >
          Copy
        </button>
      </div>
      <pre className="bg-probe-900 text-probe-50 p-4 rounded-xl overflow-x-auto text-xs">
        {content}
      </pre>
    </div>
  );
}

function SettingsTab({
  form,
  onSave,
}: {
  form: {
    title: string;
    websiteUrl: string | null;
    recipientEmail: string | null;
    allowedOrigins: string[] | null;
    endpointSettings: {
      honeypotEnabled: boolean;
      captchaProvider: "none" | "hcaptcha" | "recaptcha" | "turnstile";
      captchaSiteKey: string | null;
      subjectTemplate: string;
      webhookUrl: string | null;
      allowServerSide: boolean;
      notifyEmails: string[];
    } | null;
  };
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState(form.title);
  const [recipient, setRecipient] = useState(form.recipientEmail ?? "");
  const [origins, setOrigins] = useState((form.allowedOrigins ?? []).join("\n"));
  const [subject, setSubject] = useState(form.endpointSettings?.subjectTemplate ?? "");
  const [provider, setProvider] = useState(form.endpointSettings?.captchaProvider ?? "none");
  const [siteKey, setSiteKey] = useState(form.endpointSettings?.captchaSiteKey ?? "");
  const [captchaSecret, setCaptchaSecret] = useState("");
  const [webhookUrl, setWebhookUrl] = useState(form.endpointSettings?.webhookUrl ?? "");
  const [honeypot, setHoneypot] = useState(form.endpointSettings?.honeypotEnabled ?? true);
  const [allowServer, setAllowServer] = useState(form.endpointSettings?.allowServerSide ?? false);

  return (
    <div className="card space-y-4">
      <div>
        <label className="label text-sm">Name</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="label text-sm">Recipient email</label>
        <input
          className="input"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
        <p className="help">Changing this requires a fresh verification.</p>
      </div>
      <div>
        <label className="label text-sm">Allowed origins (one per line)</label>
        <textarea
          rows={3}
          className="input font-mono text-xs"
          value={origins}
          onChange={(e) => setOrigins(e.target.value)}
        />
        <p className="help">e.g. https://acme.example or *.acme.example</p>
      </div>
      <div>
        <label className="label text-sm">Subject template</label>
        <input
          className="input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <p className="help">
          Variables: {"{form_name}"} {"{submitter_email}"} {"{submitter_name}"}
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label text-sm">Captcha</label>
          <select
            className="input"
            value={provider}
            onChange={(e) => setProvider(e.target.value as never)}
          >
            <option value="none">None</option>
            <option value="hcaptcha">hCaptcha</option>
            <option value="recaptcha">reCAPTCHA</option>
            <option value="turnstile">Cloudflare Turnstile</option>
          </select>
        </div>
        <div>
          <label className="label text-sm">Site key</label>
          <input
            className="input"
            value={siteKey}
            onChange={(e) => setSiteKey(e.target.value)}
          />
        </div>
      </div>
      {provider !== "none" && (
        <div>
          <label className="label text-sm">Secret key (encrypted at rest)</label>
          <input
            className="input"
            type="password"
            placeholder="Leave blank to keep existing"
            value={captchaSecret}
            onChange={(e) => setCaptchaSecret(e.target.value)}
          />
        </div>
      )}
      {provider === "turnstile" && (
        <p className="help">
          Add the widget to your form so it sends a <code>cf-turnstile-response</code> token:{" "}
          <code>{`<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`}</code>{" "}
          plus <code>{`<div class="cf-turnstile" data-sitekey="YOUR_SITE_KEY"></div>`}</code> inside the form.
        </p>
      )}
      <div>
        <label className="label text-sm">Webhook URL (optional)</label>
        <input
          className="input"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
        />
        <p className="help">Signed with HMAC-SHA256 in the X-Probe-Signature header.</p>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={honeypot} onChange={(e) => setHoneypot(e.target.checked)} />
        <span className="text-sm">Honeypot enabled (botcheck field)</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={allowServer}
          onChange={(e) => setAllowServer(e.target.checked)}
        />
        <span className="text-sm">Allow server-to-server submissions (no Origin header)</span>
      </label>
      <button
        onClick={() =>
          onSave({
            title,
            recipientEmail: recipient,
            allowedOrigins: origins.split("\n").map((s) => s.trim()).filter(Boolean),
            endpointSettings: {
              subjectTemplate: subject,
              captchaProvider: provider,
              captchaSiteKey: siteKey || null,
              captchaSecret: captchaSecret || undefined,
              webhookUrl: webhookUrl || null,
              honeypotEnabled: honeypot,
              allowServerSide: allowServer,
            },
          })
        }
        className="btn btn-primary"
      >
        Save settings
      </button>
    </div>
  );
}
