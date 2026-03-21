"use client";

import { useEffect, useMemo, useState } from "react";

export function MetricDashboard({ score, headline, groups }) {
  const [activeGroup, setActiveGroup] = useState(groups?.[0]?.id || "");

  useEffect(() => {
    setActiveGroup(groups?.[0]?.id || "");
  }, [groups]);

  const currentGroup = useMemo(
    () => groups.find((group) => group.id === activeGroup) || groups[0],
    [activeGroup, groups]
  );

  return (
    <div className="panel dashboard-panel">
      <div className="dashboard-overview">
        <div
          className="score-ring"
          style={{
            "--score-angle": `${Math.round((score / 100) * 360)}deg`,
          }}
        >
          <span className="score-ring-value">{score}</span>
          <span className="score-ring-label">score</span>
        </div>

        <div className="dashboard-copy">
          <span className="section-kicker">Evaluation dashboard</span>
          <h3 className="panel-title">{headline}</h3>
          <p className="panel-copy">{currentGroup?.summary}</p>
        </div>
      </div>

      <div className="metric-tabs">
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            className={`metric-tab ${group.id === activeGroup ? "is-active" : ""}`}
            onClick={() => setActiveGroup(group.id)}
          >
            {group.label}
          </button>
        ))}
      </div>

      <div className="metric-stack">
        {currentGroup?.metrics.map((metric) => (
          <div className="metric-card" key={metric.label}>
            <div className="metric-row">
              <div>
                <strong>{metric.label}</strong>
                <p>{metric.note}</p>
              </div>
              <span>{metric.value}</span>
            </div>
            <div className="metric-bar-track">
              <span className="metric-bar-fill" style={{ width: `${metric.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
