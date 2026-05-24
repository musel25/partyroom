"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem("partyroom.theme", t);
  } catch {}
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  // Sync with whatever the inline boot script set (avoids hydration flash).
  useEffect(() => {
    const current = (document.documentElement.dataset.theme as Theme | undefined) ?? "light";
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      onClick={toggle}
      className="text-sm font-bold text-duo-muted hover:text-duo-text px-2 py-1 rounded-lg"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
