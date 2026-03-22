"use client";

import Link from "next/link";
import { AGENTS } from "../lib/agents";
import { AppShell } from "./shell";

export function AgentsPage() {
  return (
    <AppShell>
      <section className="directory-hero panel panel-padded">
        <div className="eyebrow">Agents</div>
        <h1 className="directory-title">Choose your room.</h1>
        <p className="hero-copy" style={{ maxWidth: 720 }}>
          Pick the audience you want to rehearse with, then set up the session and start the room.
        </p>
      </section>

      <section className="directory-grid">
        {AGENTS.map((agent) => (
          <Link
            href={`/agents/${agent.slug}`}
            className={`agent-card agent-card-compact ${agent.slug === "custom" ? "agent-card-featured" : ""}`}
            key={agent.slug}
          >
            <div className="agent-title-row">
              <div>
                <div className="agent-badge">{agent.role}</div>
                <h2 className="agent-title">{agent.name}</h2>
              </div>
              <div className="eyebrow">{agent.duration}</div>
            </div>
            <p className="agent-blurb">{agent.description}</p>
            <div className="pill-row">
              {agent.focus.map((item) => (
                <span className="pill" key={item}>
                  {item}
                </span>
              ))}
              {agent.slug === "coding" ? (
                <span className="pill pill-highlight">Code editor plugin</span>
              ) : null}
              {agent.slug === "custom" ? (
                <span className="pill pill-highlight">Flexible mode</span>
              ) : null}
            </div>
          </Link>
        ))}
      </section>
    </AppShell>
  );
}
