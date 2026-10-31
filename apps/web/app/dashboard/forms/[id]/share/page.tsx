"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";

import { FormTabs } from "../_components/form-tabs";

export default function SharePage() {
  const { id } = useParams<{ id: string }>();
  const formQuery = trpc.forms.get.useQuery({ id });
  const form = formQuery.data;
  const qrWrapRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");

  // Default WhatsApp message: title, description, link. Editable before sending.
  useEffect(() => {
    if (!form || message) return;
    const link = `${window.location.origin}/f/${form.slug}`;
    setMessage(
      [form.title, form.description, `Fill it in here: ${link}`].filter(Boolean).join("\n\n"),
    );
  }, [form, message]);

  if (!form) return <p className="text-probe-700">Loading…</p>;

  const url =
    typeof window !== "undefined" ? `${window.location.origin}/f/${form.slug}` : `/f/${form.slug}`;
  const embed = `<iframe src="${url}" width="100%" height="600" style="border:0"></iframe>`;

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
  }

  function downloadQr() {
    // QRCodeCanvas renders a real <canvas>; grab it and export a PNG.
    const canvas = qrWrapRef.current?.querySelector("canvas");
    if (!canvas) {
      toast.error("QR code not ready yet");
      return;
    }
    const link = document.createElement("a");
    link.download = `${form?.slug ?? "form"}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("QR downloaded");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <FormTabs id={id} responseCount={form.responseCount} />

      <div>
        <div className="text-xs text-probe-700">
          <Link href={`/dashboard/forms/${id}`} className="hover:underline">
            {form.title}
          </Link>
        </div>
        <h1 className="display text-3xl font-bold">Share</h1>
        <p className="text-sm text-probe-700 mt-1">
          Send the public link, drop in a QR code, or embed the form anywhere.
        </p>
      </div>

      {/* Public link */}
      <div className="card space-y-2">
        <div className="text-xs font-bold uppercase text-probe-700">Public link</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input className="input" readOnly value={url} aria-label="Public form link" />
          <div className="flex gap-2">
            <button onClick={() => copy(url)} className="btn btn-primary text-sm shrink-0">
              Copy
            </button>
            <Link href={`/f/${form.slug}`} target="_blank" className="btn btn-ghost text-sm shrink-0">
              Open
            </Link>
          </div>
        </div>
      </div>

      {/* WhatsApp: preview + ready-to-send message */}
      <div className="card space-y-4">
        <div className="text-xs font-bold uppercase text-probe-700">Share on WhatsApp</div>
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/f/${form.slug}/opengraph-image`}
              alt="Link preview"
              className="w-full border border-probe-200"
            />
            <p className="help">This card shows under your link in chats.</p>
          </div>
          <div className="space-y-3">
            <textarea
              className="input text-sm"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              aria-label="WhatsApp message"
            />
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary text-sm"
              >
                Share on WhatsApp
              </a>
              <button type="button" onClick={() => copy(message)} className="btn btn-ghost text-sm">
                Copy message
              </button>
            </div>
            <p className="help">
              Opens WhatsApp so you can pick a chat or group. Keep the link on its own line so
              the preview appears.
            </p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 items-start">
        {/* QR code */}
        <div className="card flex flex-col items-center gap-4">
          <div className="self-start text-xs font-bold uppercase text-probe-700">QR code</div>
          <div ref={qrWrapRef} className="bg-surface p-3 rounded-[2px] border border-probe-200">
            <QRCodeCanvas value={url} size={192} marginSize={1} />
          </div>
          <button onClick={downloadQr} className="btn btn-primary text-sm w-full justify-center">
            Download QR
          </button>
          <p className="text-xs text-probe-700 text-center">
            Saved as a PNG — drop it on posters, slides, or business cards.
          </p>
        </div>

        {/* Embed snippet */}
        <div className="card space-y-3">
          <div className="text-xs font-bold uppercase text-probe-700">Embed snippet</div>
          <p className="text-sm text-probe-700">
            Paste this into any HTML page to embed the form inline.
          </p>
          <pre className="bg-probe-900 text-probe-50 p-3 rounded-[2px] text-xs overflow-x-auto">
            {embed}
          </pre>
          <button onClick={() => copy(embed)} className="btn btn-ghost text-sm">
            Copy snippet
          </button>
        </div>
      </div>
    </div>
  );
}
