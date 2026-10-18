/** Probe mark (gold core, orbit, antenna) + serif wordmark. Mirrors app/icon.svg. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 48 48" fill="none" aria-hidden className="h-8 w-8 shrink-0">
        <circle cx="24" cy="27" r="7" fill="var(--color-signal)" />
        <ellipse
          cx="24"
          cy="27"
          rx="19"
          ry="7"
          transform="rotate(-18 24 27)"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="M24 20V6" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="24" cy="5" r="2.4" fill="currentColor" />
        <circle cx="41.2" cy="21.6" r="2.2" fill="currentColor" />
      </svg>
      <span className="font-display text-[1.65rem] font-normal leading-none tracking-[-0.03em]">
        Probe
      </span>
    </span>
  );
}
