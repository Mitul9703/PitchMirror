"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "@/components/app-provider";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteShell({ children }) {
  const pathname = usePathname();
  const { state } = useAppState();
  const isSessionRoute = pathname.startsWith("/session/");
  const hasDeck = Boolean(state.deck.fileName);

  if (isSessionRoute) {
    return children;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand-block">
          <span className="brand-kicker">AI rehearsal room</span>
          <span className="brand-title">PitchMirror</span>
        </Link>

        <div className="topbar-meta">
          <div className="status-pill">
            {hasDeck ? `Deck ready: ${state.deck.fileName}` : "Optional deck not uploaded"}
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="page-frame">{children}</main>
    </div>
  );
}
