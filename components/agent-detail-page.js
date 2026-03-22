"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AGENT_LOOKUP } from "../lib/agents";
import { AppShell } from "./shell";
import { useAppState } from "./app-provider";

function UploadStatus({ upload }) {
  if (upload.status === "uploading") {
    return (
      <div className="status-chip status-warning">
        <span className="status-dot" />
        Uploading and preparing document context...
      </div>
    );
  }

  if (upload.status === "success") {
    return (
      <div className="status-chip status-success">
        <span className="status-dot" />
        {upload.fileName} is ready for this next session.
      </div>
    );
  }

  if (upload.status === "error") {
    return (
      <div className="status-chip status-danger">
        <span className="status-dot" />
        {upload.error || "Upload failed."}
      </div>
    );
  }

  return (
    <div className="status-chip">
      <span className="status-dot" />
      PDF support is optional. Sessions can start without a file.
    </div>
  );
}

export function AgentDetailPage({ slug }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, patchAgent, clearAgentSessions } = useAppState();
  const agent = AGENT_LOOKUP[slug];
  const [localError, setLocalError] = useState("");
  const justEnded = searchParams.get("ended") === "1";

  const agentState = state.agents[slug];
  const upload = agentState?.upload;
  const pastSessions = state.sessions?.[slug] || [];

  const canStart = useMemo(() => {
    return (
      upload.status !== "uploading" &&
      agentState.session.status !== "starting" &&
      Boolean(agentState.sessionName?.trim())
    );
  }, [agentState.session.status, agentState.sessionName, upload.status]);

  if (!agent || !agentState) {
    return (
      <AppShell>
        <div className="empty-state">
          This agent was not found. Return to the <Link href="/">landing page</Link>.
        </div>
      </AppShell>
    );
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    setLocalError("");

    if (!file) return;

    if (agentState.session.status === "active" || agentState.session.status === "starting") {
      setLocalError("You cannot change the document while a session is in progress.");
      return;
    }

    if (upload.previewUrl) {
      URL.revokeObjectURL(upload.previewUrl);
    }

    const previewUrl = file.type === "application/pdf" ? URL.createObjectURL(file) : "";

    patchAgent(slug, (current) => ({
      ...current,
      upload: {
        ...current.upload,
        status: "uploading",
        fileName: file.name,
        previewUrl,
        previewOpen: false,
        contextPreview: "",
        error: "",
      },
    }));

    try {
      const formData = new FormData();
      formData.append("deck", file);

      const response = await fetch(
        "/api/upload-deck",
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      patchAgent(slug, (current) => ({
        ...current,
        upload: {
          ...current.upload,
          status: "success",
          fileName: data.fileName || file.name,
          previewUrl,
          previewOpen: false,
          contextPreview: data.contextPreview || "",
          contextText: data.contextText || "",
          error: "",
        },
      }));
    } catch (error) {
      patchAgent(slug, (current) => ({
        ...current,
        upload: {
          ...current.upload,
          status: "error",
          error: error.message || "Upload failed.",
        },
      }));
    }
  }

  function togglePreview() {
    patchAgent(slug, (current) => ({
      ...current,
      upload: {
        ...current.upload,
        previewOpen: !current.upload.previewOpen,
      },
    }));
  }

  function startSession() {
    if (!agentState.sessionName?.trim()) {
      setLocalError("Session name is required before you start.");
      return;
    }
    if (!canStart) return;
    setLocalError("");
    patchAgent(slug, (current) => ({
      ...current,
      session: {
        ...current.session,
        status: "starting",
      },
    }));
    router.push(`/session/${slug}`);
  }

  return (
    <AppShell>
      <div className="page-stack">
        <section className="detail-block page-header-card">
          <div className="button-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <Link href="/agents" className="btn btn-secondary">
              <span aria-hidden="true">←</span> Back
            </Link>
            <div className="eyebrow">{agent.role}</div>
          </div>
          <h1 className="hero-title page-title">{agent.name}</h1>
          <p className="hero-copy page-copy">{agent.description}</p>
          <div className="scenario-inline-card">
            <span className="metric-label">Scenario</span>
            <p className="muted-copy" style={{ margin: "8px 0 0" }}>{agent.scenario}</p>
          </div>
        </section>

        <section className="metric-card">
          <div className="section-title">Evaluation criteria</div>
          <div className="criteria-grid compact-scroll">
            {(agent.evaluationCriteria || []).map((criterion) => (
              <div className="subtle-card criteria-card" key={criterion.label}>
                <span className="metric-label">{criterion.label}</span>
                <p className="muted-copy" style={{ marginBottom: 0 }}>
                  {criterion.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="metric-card">
          <div className="section-title">Create a new session</div>
          <div className="setup-stack">
            <div className="subtle-card">
              <label className="label" htmlFor="session-name">
                Session name <span className="required-mark">(Required)</span>
              </label>
              <input
                id="session-name"
                className="context-textarea"
                type="text"
                value={agentState.sessionName || ""}
                onChange={(event) => {
                  setLocalError("");
                  patchAgent(slug, (current) => ({
                    ...current,
                    sessionName: event.target.value,
                  }));
                }}
                placeholder={`Example: ${agent.name} practice`}
                disabled={agentState.session.status === "active" || agentState.session.status === "starting"}
                style={{ minHeight: 52, resize: "none" }}
              />
            </div>

            <div className="subtle-card">
              <div className="section-title">Context</div>
              <div className="context-grid">
                <div className="subtle-card nested-card">
                  <label className="label" htmlFor="agent-context">
                    {agent.contextFieldLabel || "Optional role context"}
                  </label>
                  <p className="muted-copy field-hint">
                    Add any role, scenario, or audience details you want this agent to use while asking questions.
                  </p>
                  <textarea
                    id="agent-context"
                    className="context-textarea"
                    value={agentState.customContextText || ""}
                    onChange={(event) =>
                      patchAgent(slug, (current) => ({
                        ...current,
                        customContextText: event.target.value,
                      }))
                    }
                    placeholder={agent.contextFieldDescription || "Add any extra context you want this agent to use."}
                    disabled={agentState.session.status === "active" || agentState.session.status === "starting"}
                  />
                </div>

                <div className="subtle-card nested-card">
                  <label className="label" htmlFor="deck-upload">
                    Supporting document
                  </label>
                  <p className="muted-copy field-hint">
                    Upload a PDF if you want the session to pull grounded context from your document.
                  </p>
                  <input
                    id="deck-upload"
                    className="file-input"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    disabled={agentState.session.status === "active" || agentState.session.status === "starting"}
                  />
                  <div style={{ marginTop: 14 }}>
                    <UploadStatus upload={upload} />
                  </div>
                  {upload.status === "uploading" ? (
                    <div className="loader-block" style={{ marginTop: 14 }}>
                      <span className="loader-spinner" />
                      <div className="loader-lines">
                        <span />
                        <span />
                      </div>
                    </div>
                  ) : null}
                  {upload.status === "success" ? (
                    <div className="upload-preview-stack">
                      <div className="button-row" style={{ marginTop: 14 }}>
                        <button type="button" className="btn btn-secondary" onClick={togglePreview}>
                          {upload.previewOpen ? "Hide preview" : "Show preview"}
                        </button>
                      </div>
                      {upload.contextPreview ? (
                        <details className="preview-disclosure">
                          <summary>Prepared context</summary>
                          <p className="muted-copy" style={{ marginBottom: 0 }}>
                            {upload.contextPreview}
                          </p>
                        </details>
                      ) : null}
                      {upload.previewOpen && upload.previewUrl ? (
                        <iframe
                          className="preview-frame"
                          src={upload.previewUrl}
                          title={`${upload.fileName} preview`}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="agent-actions agent-actions-centered">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canStart}
                onClick={startSession}
              >
                {upload.status === "uploading" ? "Preparing..." : "Start session"}
              </button>
            </div>
            {!agentState.sessionName?.trim() ? (
              <p className="muted-copy form-note-error">Add a session name to continue.</p>
            ) : null}
            {localError ? <p className="muted-copy form-note-error">{localError}</p> : null}
          </div>
        </section>

        <section className="metric-card">
          <div className="button-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div className="section-title">Past sessions{justEnded ? " • updated" : ""}</div>
            {pastSessions.length ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => clearAgentSessions(slug)}
              >
                Delete history
              </button>
            ) : null}
          </div>
          {pastSessions.length ? (
            <div className="session-list compact-scroll">
              {pastSessions.map((session) => (
                <Link
                  href={`/agents/${slug}/sessions/${session.id}`}
                  className="session-list-item session-card-wide"
                  key={session.id}
                >
                  <div className="session-list-top">
                    <strong>{session.sessionName || "Untitled session"}</strong>
                    <span className="pill">{session.durationLabel}</span>
                  </div>
                  <div className="session-meta-grid">
                    <span>{new Date(session.endedAt).toLocaleString()}</span>
                    <span>{session.upload?.fileName || "No supporting file"}</span>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    {session.evaluation?.status === "processing" ? (
                      <div className="status-chip status-warning">
                        <span className="status-dot" />
                        Evaluation processing...
                      </div>
                    ) : session.evaluation?.status === "failed" ? (
                      <div className="status-chip status-danger">
                        <span className="status-dot" />
                        Evaluation failed
                      </div>
                    ) : (
                      <div className="status-chip status-success">
                        <span className="status-dot" />
                        Evaluation ready
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">No past sessions yet.</div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
