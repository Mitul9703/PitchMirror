"use client";

import Link from "next/link";
import { AGENT_LIST } from "@/lib/agents";
import { useAppState } from "@/components/app-provider";

export function LandingPage() {
  const { state } = useAppState();
  const completedRuns = Object.keys(state.reports || {}).length;

  return (
    <div className="landing-stack">
      <section className="hero-grid">
        <div className="hero-panel">
          <span className="hero-eyebrow">Claude-toned rehearsal workspace</span>
          <h1 className="hero-title">
            Practice with a live avatar room that feels closer to a real panel than a chatbot.
          </h1>
          <p className="hero-copy">
            Pick a judge, add an optional deck, open a dedicated session window, and come back
            to a scored static report when the call ends.
          </p>

          <div className="hero-actions">
            <Link href="/agents/recruiter" className="primary-button">
              Enter Recruiter Mirror
            </Link>
            <Link href="/agents/custom" className="secondary-button">
              Build a Custom Judge
            </Link>
          </div>
        </div>

        <div className="hero-panel hero-panel-secondary">
          <div className="hero-stat-grid">
            <div className="hero-stat">
              <span className="hero-stat-label">Judges</span>
              <strong>4 rooms</strong>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-label">Deck support</span>
              <strong>Optional PDF context</strong>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-label">Live session</span>
              <strong>Simli avatar + voice bridge</strong>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-label">Reports run</span>
              <strong>{completedRuns}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="section-header">
        <div>
          <span className="section-kicker">Choose a room</span>
          <h2 className="section-title">Scenario-specific judges</h2>
        </div>
      </section>

      <section className="agent-grid">
        {AGENT_LIST.map((agent) => {
          const report = state.reports?.[agent.id];

          return (
            <Link href={`/agents/${agent.id}`} key={agent.id} className="agent-card">
              <div className="agent-card-header">
                <span className="agent-card-tag">{agent.badge}</span>
                <span className="agent-card-score">
                  {report ? `${report.score}/100 latest` : `${agent.report.score}/100 target`}
                </span>
              </div>

              <h3 className="agent-card-title">{agent.name}</h3>
              <p className="agent-card-copy">{agent.strap}</p>

              <div className="agent-chip-row">
                {agent.focus.map((item) => (
                  <span key={item} className="agent-chip">
                    {item}
                  </span>
                ))}
              </div>

              <div className="agent-card-footer">
                <span>{agent.audience}</span>
                <span>{agent.duration}</span>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
