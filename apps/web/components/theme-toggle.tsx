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
      className={`grid h-9 w-9 place-items-center rounded-lg border border-probe-200 text-probe-900 transition-colors hover:bg-probe-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-probe-500 ${className}`}
    >
      {/* aria-hidden: the button's aria-label conveys the action */}
      <span aria-hidden className="text-base leading-none">
        {mounted ? (isDark ? "☀️" : "🌙") : "🌓"}
      </span>
    </button>
  );
}
