/** Probe brand mark + wordmark. The mark mirrors app/icon.svg (the favicon). */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 48 48" fill="none" aria-hidden className="h-7 w-7 shrink-0">
        <rect width="48" height="48" rx="12" fill="#AD5614" />
        <path
          d="M13 38V12h9.5a9.5 9.5 0 0 1 0 19H13"
          stroke="#FFFFFF"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="22.5" cy="21.5" r="3" fill="#FFFFFF" />
        <path
          d="M38 13a11 11 0 0 1 0 17"
          stroke="#FFFFFF"
          strokeOpacity="0.55"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span>probe</span>
    </span>
  );
}
