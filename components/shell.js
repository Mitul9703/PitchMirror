"use client";

import Link from "next/link";
import { useAppState } from "./app-provider";

export function AppShell({ children, compact = false }) {
  const { state, setTheme, toasts, dismissToast } = useAppState();
  const isLight = state.theme === "light";

  return (
    <div className="app-shell">
      <div className="page-frame">
        <header className="topbar">
          <Link href="/" className="brand">
            <div>
              <div className="brand-title">PitchMirror</div>
              <div className="brand-subtitle">
                {compact
                  ? "Live rehearsal room"
                  : "AI rehearsal room"}
              </div>
            </div>
          </Link>
          <button
            type="button"
            className="theme-toggle"
            aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
            onClick={() => setTheme(isLight ? "dark" : "light")}
          >
            <span className={`theme-toggle-track ${isLight ? "light" : "dark"}`}>
              <span className="theme-toggle-thumb">
                <span className="theme-icon-sun" />
                <span className="theme-icon-moon" />
              </span>
            </span>
          </button>
        </header>
        {children}
        {toasts.length ? (
          <div className="toast-stack">
            {toasts.map((toast) => (
              <button
                type="button"
                key={toast.id}
                className="toast"
                onClick={() => dismissToast(toast.id)}
              >
                {toast.message}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
