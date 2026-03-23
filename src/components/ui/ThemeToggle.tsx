"use client";

import { useCallback, useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = useCallback(() => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }, [dark]);

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-700"
      aria-label="Toggle theme"
    >
      {dark ? "\u2600\uFE0F" : "\uD83C\uDF19"}
    </button>
  );
}
