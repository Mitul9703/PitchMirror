"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app-provider";
import { MetricDashboard } from "@/components/metric-dashboard";
import { RatingPanel } from "@/components/rating-panel";
import { getAgent } from "@/lib/agents";
import { BACKEND_URL } from "@/lib/runtime";

export function AgentDetailPage({ agentId }) {
  const router = useRouter();
  const agent = getAgent(agentId);
  const { state, actions } = useAppState();
  const fileInputRef = useRef(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [pageError, setPageError] = useState("");

  const report = state.reports?.[agentId] || null;
  const isUploading = state.deck.status === "uploading";
  const activeSession = state.activeSession;
  const anotherSessionActive =
    activeSession.status !== "idle" && activeSession.agentId && activeSession.agentId !== agentId;
  const currentSessionActive =
    activeSession.status !== "idle" && activeSession.agentId === agentId;
  const uploadLocked = state.deck.locked || activeSession.status !== "idle";
  const canStartSession = !isUploading && !uploadLocked;

  const dashboard = useMemo(() => report?.dashboard || agent.dashboard, [agent.dashboard, report]);
  const dashboardScore = report?.score || agent.report.score;
  const dashboardHeadline = report?.headline || `${agent.name} evaluation targets`;

  const logAgentPage = (message, payload) => {
    if (typeof payload === "undefined") {
      console.log(`[PitchMirror][Agent:${agentId}] ${message}`);
      return;
    }

    console.log(`[PitchMirror][Agent:${agentId}] ${message}`, payload);
  };

  const uploadDeck = async (file) => {
    setPageError("");

    if (uploadLocked) {
      logAgentPage("upload blocked because session is active");
      setPageError("The document uploader is locked while a live session is active.");
      return;
    }

    if (!file) {
      logAgentPage("upload skipped because no file was selected");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      logAgentPage("upload blocked because file is not a PDF", file.name);
      setPageError("The current backend flow supports PDF decks only.");
      return;
    }

    try {
      logAgentPage("starting deck upload", file.name);
      setSelectedFileName(file.name);
      actions.beginUpload();

      const formData = new FormData();
      formData.append("deck", file);

      const response = await fetch(`${BACKEND_URL}/upload-deck`, {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Upload failed.");
      }

      actions.completeUpload({
        fileName: payload.fileName,
        contextPreview: payload.contextPreview,
      });

      logAgentPage("deck upload completed", payload.fileName);
    } catch (error) {
      console.error(`[PitchMirror][Agent:${agentId}] deck upload failed`, error);
      actions.failUpload(error.message);
      setPageError(error.message);
    } finally {
      setSelectedFileName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeckSelection = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await uploadDeck(file);
  };

  const handleStartSession = () => {
    setPageError("");
    logAgentPage("start session requested");

    if (isUploading) {
      logAgentPage("start blocked because upload is in progress");
      setPageError("Wait for the document upload to finish before starting the room.");
      return;
    }

    if (anotherSessionActive) {
      logAgentPage("start blocked because another room is active", activeSession);
      setPageError("Another agent room is already live. End that call before opening a new one.");
      return;
    }

    actions.startSession(agentId, "launching");
    logAgentPage("navigating to in-tab session screen");
    router.push(`/session/${agentId}`);
  };

  return (
    <div className="detail-grid">
      <section className="detail-main">
        <div className="panel agent-hero-panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">{agent.badge}</span>
              <h1 className="section-title">{agent.name}</h1>
            </div>
            <Link href="/" className="ghost-button">
              Back to landing
            </Link>
          </div>

          <p className="panel-copy">{agent.strap}</p>

          <div className="agent-chip-row">
            {agent.focus.map((item) => (
              <span key={item} className="agent-chip">
                {item}
              </span>
            ))}
          </div>

          <div className="info-list">
            <div className="info-row">
              <span>Audience</span>
              <strong>{agent.audience}</strong>
            </div>
            <div className="info-row">
              <span>Session length</span>
              <strong>{agent.duration}</strong>
            </div>
            {agent.details.map((detail) => (
              <div className="info-row" key={detail}>
                <span>Flow</span>
                <strong>{detail}</strong>
              </div>
            ))}
          </div>
        </div>

        {currentSessionActive ? (
          <div className="panel alert-panel">
            <div className="status-pill">Live room active</div>
            <p className="panel-copy">
              The current {agent.name} session is still live. End the call before starting again.
            </p>
          </div>
        ) : null}

        {anotherSessionActive ? (
          <div className="panel alert-panel">
            <div className="status-pill">Another room is active</div>
            <p className="panel-copy">
              A different agent room is already live. End that call before starting this one.
            </p>
          </div>
        ) : null}

        <MetricDashboard
          score={dashboardScore}
          headline={dashboardHeadline}
          groups={dashboard}
        />

        {report ? (
          <div className="panel" id="evaluation">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Post-call summary</span>
                <h2 className="panel-title">Static evaluation report</h2>
              </div>
              <div className="status-pill">
                {new Date(report.completedAt).toLocaleString()}
              </div>
            </div>

            <p className="panel-copy">{report.summary}</p>

            <div className="summary-grid">
              <div className="summary-card">
                <h3>What landed</h3>
                <ul className="summary-list">
                  {report.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="summary-card">
                <h3>Improve next</h3>
                <ul className="summary-list">
                  {report.focusAreas.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="summary-card">
                <h3>Practice sources</h3>
                <ul className="summary-list">
                  {report.sources.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <RatingPanel agentId={agentId} rating={report.rating} />
          </div>
        ) : null}
      </section>

      <aside className="detail-side">
        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Session setup</span>
              <h2 className="panel-title">Room behavior</h2>
            </div>
          </div>

          <div className="info-list">
            <div className="info-row">
              <span>Launch</span>
              <strong>The call opens in this tab as a dedicated rehearsal screen.</strong>
            </div>
            <div className="info-row">
              <span>Microphone</span>
              <strong>The room asks for mic access before the avatar appears.</strong>
            </div>
            <div className="info-row">
              <span>Avatar</span>
              <strong>Simli is preconfigured in the background without exposing credentials.</strong>
            </div>
          </div>
        </div>

        {agentId === "custom" ? (
          <div className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Custom brief</span>
                <h2 className="panel-title">Describe the judge</h2>
              </div>
            </div>

            <label className="field">
              <span className="field-label">Scenario notes</span>
              <textarea
                className="textarea"
                rows={6}
                value={state.customBrief}
                onChange={(event) => actions.setCustomBrief(event.target.value)}
                placeholder="Example: Act like a skeptical CS professor reviewing a startup thesis defense."
              />
            </label>
          </div>
        ) : null}

        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Optional context</span>
              <h2 className="panel-title">Supporting PDF</h2>
            </div>
            <div className="status-pill">
              {isUploading ? "Uploading..." : state.deck.fileName ? "Deck ready" : "No deck"}
            </div>
          </div>

          <label className="upload-box">
            <span className="field-label">Choose briefing deck</span>
            <input
              ref={fileInputRef}
              className="input"
              type="file"
              accept=".pdf"
              disabled={uploadLocked}
              onChange={handleDeckSelection}
            />
          </label>

          <div className="upload-meta">
            {selectedFileName ? (
              <div className="file-pill">Uploading: {selectedFileName}</div>
            ) : null}

            {state.deck.fileName ? (
              <div className="file-pill">Latest uploaded: {state.deck.fileName}</div>
            ) : null}
          </div>

          {state.deck.contextPreview ? (
            <div className="preview-card">
              <strong>Context preview</strong>
              <p>{state.deck.contextPreview}</p>
            </div>
          ) : null}

          <p className="field-note">
            File upload is optional. The file is uploaded immediately after selection, and start is
            blocked while processing is in progress.
          </p>

          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              onClick={handleStartSession}
              disabled={!canStartSession}
            >
              {currentSessionActive ? "Room live" : "Start session"}
            </button>
          </div>

          {pageError || state.deck.error ? (
            <p className="error-text">{pageError || state.deck.error}</p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
