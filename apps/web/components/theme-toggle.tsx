"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Light/dark theme toggle. Uses next-themes (class strategy on <html>), which
 * persists the choice and respects system preference. Renders a stable
 * placeholder until mounted to avoid a hydration mismatch on the icon.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"}
      title="Toggle theme"
      className={`grid h-9 w-9 place-items-center btn-ghost rounded-md border text-probe-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-probe-500 ${className}`}
    >
      {/* aria-hidden: the button's aria-label conveys the action */}
      <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {mounted && isDark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        )}
      </svg>
    </button>
  );
}
