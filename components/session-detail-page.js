"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AGENT_LOOKUP } from "../lib/agents";
import { AppShell } from "./shell";
import { useAppState } from "./app-provider";

function domainLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_error) {
    return url;
  }
}

function resourceBadge(kind) {
  if ((kind || "").toLowerCase() === "youtube") {
    return (
      <span className="resource-icon youtube" aria-hidden="true">
        <span className="youtube-play" />
      </span>
    );
  }

  return <span className="resource-kind">{kind || "resource"}</span>;
}

export function SessionDetailPage({ slug, sessionId }) {
  const { state, requestResourceFetch, requestSessionComparison } = useAppState();
  const agent = AGENT_LOOKUP[slug];
  const session = (state.sessions?.[slug] || []).find((item) => item.id === sessionId);

  if (!agent || !session) {
    return (
      <AppShell>
        <div className="empty-state">
          Session not found. Return to <Link href={`/agents/${slug}`}>the agent page</Link>.
        </div>
      </AppShell>
    );
  }

  const evaluation = session.evaluation;
  const resources = session.resources || { status: "idle", topics: [], briefs: [] };
  const comparison = session.comparison || {
    status: "idle",
    baselineSessionId: "",
    result: null,
    error: "",
  };
  const comparisonOptions = useMemo(
    () =>
      (state.sessions?.[slug] || []).filter(
        (item) =>
          item.id !== sessionId &&
          item.evaluation?.status === "completed" &&
          item.evaluation?.result,
      ),
    [slug, sessionId, state.sessions],
  );
  const [selectedComparisonId, setSelectedComparisonId] = useState(
    comparison.baselineSessionId || comparisonOptions[0]?.id || "",
  );
  const [isGuidanceOpen, setIsGuidanceOpen] = useState(true);

  useEffect(() => {
    const preferredId =
      comparison.baselineSessionId &&
      comparisonOptions.some((item) => item.id === comparison.baselineSessionId)
        ? comparison.baselineSessionId
        : comparisonOptions[0]?.id || "";
    setSelectedComparisonId(preferredId);
  }, [comparison.baselineSessionId, comparisonOptions]);

  return (
    <AppShell>
      <div className="page-stack">
        <section className="detail-block page-header-card">
          <div className="button-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <Link href={`/agents/${slug}`} className="btn btn-secondary">
              <span aria-hidden="true">←</span> Back
            </Link>
            <div className="eyebrow">Saved session</div>
          </div>
          <h1 className="hero-title page-title">
            {session.sessionName || `${agent.name} session`}
          </h1>
          <p className="hero-copy page-copy">
            Ended {new Date(session.endedAt).toLocaleString()} with duration {session.durationLabel}.
          </p>
        </section>

        <section className="metric-card">
          <div className="section-title">Session info</div>
          <div className="session-info-grid">
            <div className="subtle-card">
              <span className="metric-label">Agent</span>
              <div className="metric-value">{agent.name}</div>
            </div>
            <div className="subtle-card">
              <span className="metric-label">File</span>
              <div className="metric-value">{session.upload?.fileName || "No file"}</div>
            </div>
          </div>
          {session.customContext ? (
            <details className="content-disclosure" open={false}>
              <summary>Context</summary>
              <p className="muted-copy" style={{ marginBottom: 0 }}>
                {session.customContext}
              </p>
            </details>
          ) : null}
          {session.upload?.contextPreview ? (
            <details className="content-disclosure" open={false}>
              <summary>Prepared file context</summary>
              <p className="muted-copy" style={{ marginBottom: 0 }}>
                {session.upload.contextPreview}
              </p>
            </details>
          ) : null}
          {session.coding ? (
            <details className="content-disclosure" open={false}>
              <summary>Final code • {session.coding.language || "Unspecified"}</summary>
              <pre className="code-block">{session.coding.finalCode || "// No code was saved."}</pre>
            </details>
          ) : null}
        </section>

        <section className="metric-card">
          <div className="section-title">Evaluation</div>
          {evaluation.status === "processing" ? (
            <div className="subtle-card">
              <div className="status-chip status-warning">
                <span className="status-dot" />
                Evaluation processing...
              </div>
              <div className="loader-block">
                <span className="loader-spinner" />
                <div className="loader-lines">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          ) : evaluation.status === "failed" ? (
            <div className="subtle-card">
              <div className="status-chip status-danger">
                <span className="status-dot" />
                Evaluation failed
              </div>
              <p className="muted-copy" style={{ marginTop: 12, marginBottom: 0 }}>
                {evaluation.error || "The evaluation could not be completed."}
              </p>
            </div>
          ) : (
            <>
              <div className="evaluation-shell">
                <div className="dashboard-score">
                  {evaluation.result.score}/100
                </div>
                <p className="muted-copy" style={{ maxWidth: 720 }}>{evaluation.result.summary}</p>
              </div>
              <div className="metrics-grid compact-scroll">
                {evaluation.result.metrics.map((metric) => (
                  <div className="subtle-card" key={metric.label}>
                    <span className="metric-label">{metric.label}</span>
                    <div className="metric-value">{metric.value}%</div>
                    <div className="progress" style={{ marginTop: 10 }}>
                      <span style={{ width: `${metric.value}%` }} />
                    </div>
                    {metric.justification ? (
                      <p className="muted-copy" style={{ marginTop: 12, marginBottom: 0 }}>
                        {metric.justification}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="grid-2" style={{ marginTop: 16 }}>
                <div className={`content-disclosure ${isGuidanceOpen ? "is-open" : ""}`}>
                  <button
                    type="button"
                    className="disclosure-toggle"
                    aria-expanded={isGuidanceOpen}
                    onClick={() => setIsGuidanceOpen((current) => !current)}
                  >
                    <span>Improvements</span>
                  </button>
                  {isGuidanceOpen ? (
                  <ul className="list compact-scroll">
                    {evaluation.result.improvements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  ) : null}
                </div>
                {evaluation.result.recommendations?.length ? (
                  <div className={`content-disclosure ${isGuidanceOpen ? "is-open" : ""}`}>
                    <button
                      type="button"
                      className="disclosure-toggle"
                      aria-expanded={isGuidanceOpen}
                      onClick={() => setIsGuidanceOpen((current) => !current)}
                    >
                      <span>Next steps</span>
                    </button>
                    {isGuidanceOpen ? (
                      <ul className="list compact-scroll">
                        {(evaluation.result.recommendations || []).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>

        <section className="metric-card">
          <div className="section-title">Improvement resources</div>
          {resources.status === "idle" ? (
            <div className="subtle-card">
              <p className="muted-copy" style={{ margin: 0 }}>
                Fetch links for the main improvement areas from this session.
              </p>
              {resources.briefs?.length ? (
                <div className="button-row" style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className="btn btn-accent"
                    onClick={() => requestResourceFetch(slug, sessionId)}
                  >
                    Fetch resources
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {resources.status === "processing" ? (
            <div className="subtle-card">
              <div className="status-chip status-warning">
                <span className="status-dot" />
                Finding resources...
              </div>
              <div className="loader-block">
                <span className="loader-spinner" />
                <div className="loader-lines">
                  <span />
                  <span />
                </div>
              </div>
            </div>
          ) : null}
          {resources.status === "failed" ? (
            <div className="subtle-card">
              <div className="status-chip status-danger">
                <span className="status-dot" />
                Resource search failed
              </div>
              <p className="muted-copy" style={{ marginTop: 12, marginBottom: 0 }}>
                {resources.error || "Resources could not be loaded."}
              </p>
              {resources.briefs?.length ? (
                <div className="button-row" style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => requestResourceFetch(slug, sessionId)}
                  >
                    Try again
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {resources.status === "completed" && resources.topics?.length ? (
            <div className="resource-accordion">
              {resources.topics.map((topic, index) => (
                <details
                  className="resource-group"
                  key={topic.id || topic.topic}
                  open={index === 0}
                >
                    <summary className="resource-summary">
                      <div>
                        <div className="resource-topic">{topic.topic}</div>
                      <p className="muted-copy" style={{ margin: "6px 0 0" }}>
                        {topic.whyThisMatters}
                      </p>
                      </div>
                      <span className="pill resource-count-pill">
                        {topic.items?.length || 0}
                      </span>
                    </summary>
                  <div className="resource-grid">
                      {(topic.items || []).map((item) => (
                        <a
                          key={`${topic.id}-${item.url}`}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                          className="resource-card"
                        >
                          <div className="button-row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                            {resourceBadge(item.type)}
                            <span className="metric-label">{item.source || domainLabel(item.url)}</span>
                          </div>
                          <div className="resource-title">{item.title}</div>
                          <p className="muted-copy" style={{ marginTop: 10, marginBottom: 12 }}>
                            {item.reason}
                          </p>
                          <span className="link-button icon-link" aria-label={`Open ${domainLabel(item.url)}`}>
                            ↗
                          </span>
                        </a>
                      ))}
                  </div>
                </details>
              ))}
            </div>
          ) : null}
          {resources.status === "completed" && !resources.topics?.length ? (
            <div className="subtle-card">
              <p className="muted-copy" style={{ margin: 0 }}>
                No resources saved for this session.
              </p>
            </div>
          ) : null}
        </section>

        <section className="metric-card">
          <div className="section-title">Session comparison</div>
            {evaluation.status !== "completed" ? (
              <div className="subtle-card">
                <p className="muted-copy" style={{ margin: 0 }}>
                  Finish the evaluation first to compare this session.
                </p>
              </div>
            ) : !comparisonOptions.length ? (
              <div className="subtle-card">
                <p className="muted-copy" style={{ margin: 0 }}>
                  Save one more completed session to compare progress here.
                </p>
              </div>
            ) : (
              <>
                <div className="subtle-card">
                  <div className="button-row compare-controls">
                    <select
                      className="language-select compare-select"
                      value={selectedComparisonId}
                      onChange={(event) => setSelectedComparisonId(event.target.value)}
                    >
                      {comparisonOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {(option.sessionName || "Untitled session")} · {new Date(option.endedAt).toLocaleString()} · {option.durationLabel}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-accent"
                      disabled={!selectedComparisonId || comparison.status === "processing"}
                      onClick={() =>
                        requestSessionComparison(slug, sessionId, selectedComparisonId)
                      }
                    >
                      {comparison.status === "processing"
                        ? "Comparing..."
                        : "Compare with other session"}
                    </button>
                  </div>
                </div>

                {comparison.status === "processing" ? (
                  <div className="subtle-card" style={{ marginTop: 16 }}>
                    <div className="status-chip status-warning">
                      <span className="status-dot" />
                      Comparison processing...
                    </div>
                    <div className="loader-block">
                      <span className="loader-spinner" />
                      <div className="loader-lines">
                        <span />
                        <span />
                      </div>
                    </div>
                  </div>
                ) : null}

                {comparison.status === "failed" ? (
                  <div className="subtle-card" style={{ marginTop: 16 }}>
                    <div className="status-chip status-danger">
                      <span className="status-dot" />
                      Comparison failed
                    </div>
                    <p className="muted-copy" style={{ marginTop: 12, marginBottom: 0 }}>
                      {comparison.error || "The comparison could not be completed."}
                    </p>
                  </div>
                ) : null}

                {comparison.status === "completed" && comparison.result ? (
                  <div className="comparison-stack">
                    <div className="subtle-card comparison-summary-card">
                      <div className={`status-chip ${comparison.result.trend === "improved"
                        ? "status-success"
                        : comparison.result.trend === "declined"
                          ? "status-danger"
                          : "status-warning"}`}
                      >
                        <span className="status-dot" />
                        {comparison.result.trend}
                      </div>
                      <p className="muted-copy" style={{ margin: "12px 0 0" }}>
                        {comparison.result.summary}
                      </p>
                    </div>
                    <div className="comparison-grid">
                      {comparison.result.metrics.map((metric) => {
                        const deltaPrefix = metric.delta > 0 ? "+" : "";
                        const trendClass =
                          metric.trend === "improved"
                            ? "comparison-delta positive"
                            : metric.trend === "declined"
                              ? "comparison-delta negative"
                              : "comparison-delta neutral";

                        return (
                          <div className="subtle-card comparison-metric-card" key={metric.label}>
                            <div className="button-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                              <span className="metric-label">{metric.label}</span>
                              <span className={trendClass}>{deltaPrefix}{metric.delta}</span>
                            </div>
                            <div className="comparison-scoreline">
                              <span>Now {metric.currentValue}</span>
                              <span>Earlier {metric.baselineValue}</span>
                            </div>
                            <p className="muted-copy" style={{ marginTop: 12, marginBottom: 0 }}>
                              {metric.insight}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </>
            )}
        </section>

        <section className="detail-block">
          <div className="section-title">Transcript</div>
          <div className="transcript-list transcript-scroll">
            {session.transcript.length ? (
              session.transcript.map((entry) => (
                <div className="transcript-item" key={entry.id}>
                  <div className="transcript-role">{entry.role}</div>
                  <p className="transcript-text">{entry.text}</p>
                </div>
              ))
            ) : (
              <div className="empty-state">No transcript was saved for this session.</div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
