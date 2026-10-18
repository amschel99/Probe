import { toast } from "sonner";

/**
 * Contextual "buy me a chai" nudges. These are donation prompts, not paywalls —
 * nothing is gated. They only appear on the hosted instance (gated by
 * NEXT_PUBLIC_ENABLE_CHAI_NUDGE) so self-hosters never see *our* donate link.
 */

export const CHAI_DONATE_URL = process.env.NEXT_PUBLIC_RAZORPAY_DONATE_LINK ?? "";

export const CHAI_NUDGE_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_CHAI_NUDGE === "true" &&
  CHAI_DONATE_URL.length > 0 &&
  !CHAI_DONATE_URL.includes("your-link-here");

const COOLDOWN_MS = 1000 * 60 * 60 * 24; // at most one toast nudge per day
const SNOOZE_KEY = "chai-nudge:snoozed-until";
/** Set when the user opts out for good (from a toast or the footer). Silences every surface. */
export const CHAI_DISMISS_KEY = "chai-nudge:dismissed";

/** Whether the user has permanently opted out of donation nudges. */
export function isChaiDismissed() {
  return typeof window !== "undefined" && localStorage.getItem(CHAI_DISMISS_KEY) === "1";
}

function openDonate() {
  window.open(CHAI_DONATE_URL, "_blank", "noopener,noreferrer");
}

/** Fire a one-off, cooldown-throttled donation toast at a moment of realized value. */
export function nudgeChai(message: string) {
  if (!CHAI_NUDGE_ENABLED || typeof window === "undefined") return;
  if (isChaiDismissed()) return;

  const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
  if (Date.now() < snoozedUntil) return;
  localStorage.setItem(SNOOZE_KEY, String(Date.now() + COOLDOWN_MS));

  // Custom card: full-width message, dismiss ✕ top-right, two actions along the
  // bottom — instead of sonner's cramped inline action/cancel buttons.
  toast.custom(
    (id) => (
      <div className="relative w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-probe-200 bg-white p-4 shadow-[0_12px_40px_-12px_rgba(59,42,26,0.35)]">
        <button
          type="button"
          onClick={() => toast.dismiss(id)}
          aria-label="Dismiss"
          className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full text-probe-700 transition-colors hover:bg-probe-100 hover:text-probe-900"
        >
          ✕
        </button>
        <div className="flex items-start gap-3 pr-6">
          <span className="text-2xl leading-none" aria-hidden>
            ☕
          </span>
          <p className="text-sm leading-snug text-probe-900">{message}</p>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              openDonate();
              toast.dismiss(id);
            }}
            className="btn btn-primary flex-1 justify-center text-sm"
          >
            Send a tip
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(CHAI_DISMISS_KEY, "1");
              toast.dismiss(id);
            }}
            className="btn btn-ghost flex-1 justify-center text-sm"
          >
            Already did 💛
          </button>
        </div>
      </div>
    ),
    { duration: 12000 },
  );
}
