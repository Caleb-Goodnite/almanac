"use client";

import { useCallback } from "react";

const ORDER = ["system", "light", "dark"] as const;
type Mode = (typeof ORDER)[number];

function current(): Mode {
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : "system";
}

/** Cycles System, Light, Dark. Stored in a cookie so the server renders it. */
export function ThemeToggle({ className }: { className?: string }) {
  const cycle = useCallback(() => {
    const next = ORDER[(ORDER.indexOf(current()) + 1) % ORDER.length] ?? "system";
    const root = document.documentElement;
    if (next === "system") {
      delete root.dataset.theme;
      document.cookie = "theme=; path=/; max-age=0; samesite=lax";
    } else {
      root.dataset.theme = next;
      document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    }
    const status = document.getElementById("theme-status");
    if (status) status.textContent = `Theme: ${next}`;
  }, []);

  return (
    <button type="button" onClick={cycle} className={className}>
      <span className="label min-h-11 inline-flex items-center underline decoration-dotted underline-offset-4 hover:text-ink">
        Change theme
      </span>
      <span id="theme-status" role="status" className="sr-only" />
    </button>
  );
}
