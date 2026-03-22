"use client";

import Link from "next/link";
import { AppShell } from "./shell";

export function LandingPage() {
  return (
    <AppShell>
      <section className="landing-shell">
        <div className="landing-hero panel panel-padded">
          <div className="eyebrow">PitchMirror</div>
          <h1 className="hero-title landing-title">
            Rehearse the room before you ever walk into it.
          </h1>
          <p className="hero-copy landing-copy">
            PitchMirror pairs live Simli avatars with role-specific coaching
            surfaces so you can practice interviews, lectures, startup pitches,
            and high-pressure Q and A in one calm workspace.
          </p>
          <div className="landing-cta">
            <Link href="/agents" className="btn btn-primary">
              View agents
            </Link>
          </div>
        </div>

        <div className="session-feel-card panel panel-padded">
          <div className="section-title">How a session feels</div>
          <div className="session-feel-row">
            <div className="session-step">
              <span className="session-step-number">1</span>
              <div>
                <strong>Set up</strong>
                <p className="muted-copy">Pick a room, add context, upload a file if you want.</p>
              </div>
            </div>
            <div className="session-step">
              <span className="session-step-number">2</span>
              <div>
                <strong>Rehearse</strong>
                <p className="muted-copy">Join the live room and answer in a realistic back-and-forth.</p>
              </div>
            </div>
            <div className="session-step">
              <span className="session-step-number">3</span>
              <div>
                <strong>Review</strong>
                <p className="muted-copy">Come back to your saved session for evaluation, resources, and comparison.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
