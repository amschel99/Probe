"use client";

import { useEffect, useState } from "react";

import { CHAI_DISMISS_KEY, CHAI_DONATE_URL, CHAI_NUDGE_ENABLED } from "@/lib/chai";

/**
 * A quiet, dismissible donation banner for the dashboard footer. Nothing is gated —
 * it's a thank-you-ware ask. Only renders on the hosted instance (CHAI_NUDGE_ENABLED)
 * and disappears for good once dismissed (shared with the toast nudges).
 */
export function ChaiFooter() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (CHAI_NUDGE_ENABLED && localStorage.getItem(CHAI_DISMISS_KEY) !== "1") {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="border-t border-probe-200 bg-probe-100">
      <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-probe-700">
          Probe is free &amp; open source — every feature, forever. If it&apos;s saving
          you time, you can leave a tip.
        </p>
        <div className="flex items-center gap-2">
          <a
            href={CHAI_DONATE_URL}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary text-sm"
          >
            Buy a chai — ₹99
          </a>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(CHAI_DISMISS_KEY, "1");
              setShow(false);
            }}
            className="btn btn-ghost text-sm"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
