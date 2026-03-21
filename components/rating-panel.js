"use client";

import { useState } from "react";
import { useAppState } from "@/components/app-provider";

export function RatingPanel({ agentId, rating }) {
  const { actions } = useAppState();
  const [expanded, setExpanded] = useState(Boolean(rating));

  return (
    <div className="rating-panel">
      <button
        type="button"
        className="secondary-button"
        onClick={() => setExpanded((current) => !current)}
      >
        Rate the conversation
      </button>

      {expanded ? (
        <div className="rating-row">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={`rating-button ${rating === value ? "is-active" : ""}`}
              onClick={() => actions.rateConversation(agentId, value)}
            >
              {value}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
