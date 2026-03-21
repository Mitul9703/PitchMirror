"use client";

import { useAppState } from "@/components/app-provider";

export function ThemeToggle() {
  const { state, actions } = useAppState();
  const nextTheme = state.theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => actions.setTheme(nextTheme)}
    >
      {nextTheme === "light" ? "Switch to Light" : "Switch to Dark"}
    </button>
  );
}
