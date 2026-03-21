"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";
import {
  clearSessionHeartbeat,
  isSessionHeartbeatFresh,
  normalizeCredentials,
  readSessionHeartbeat,
  SESSION_STARTUP_GRACE_MS,
} from "@/lib/runtime";

const STORAGE_KEY = "pitchmirror-state-v1";

const initialState = {
  theme: "dark",
  credentials: normalizeCredentials(),
  customBrief: "",
  deck: {
    status: "idle",
    fileName: "",
    contextPreview: "",
    uploadedAt: "",
    error: "",
    locked: false,
  },
  activeSession: {
    agentId: "",
    status: "idle",
    startedAt: "",
  },
  reports: {},
};

const AppStateContext = createContext(null);

function mergeState(payload) {
  return {
    ...initialState,
    ...payload,
    credentials: {
      ...normalizeCredentials(payload?.credentials),
    },
    deck: {
      ...initialState.deck,
      ...(payload?.deck || {}),
    },
    activeSession: {
      ...initialState.activeSession,
      ...(payload?.activeSession || {}),
    },
    reports: payload?.reports || {},
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "hydrate":
    case "sync_state":
      return mergeState(action.payload);
    case "set_theme":
      return {
        ...state,
        theme: action.payload,
      };
    case "set_credentials":
      return {
        ...state,
        credentials: normalizeCredentials({
          ...state.credentials,
          ...action.payload,
        }),
      };
    case "set_custom_brief":
      return {
        ...state,
        customBrief: action.payload,
      };
    case "upload_pending":
      return {
        ...state,
        deck: {
          ...state.deck,
          status: "uploading",
          error: "",
        },
      };
    case "upload_success":
      return {
        ...state,
        deck: {
          ...state.deck,
          status: "ready",
          fileName: action.payload.fileName,
          contextPreview: action.payload.contextPreview,
          uploadedAt: new Date().toISOString(),
          error: "",
        },
      };
    case "upload_failure":
      return {
        ...state,
        deck: {
          ...state.deck,
          status: "error",
          error: action.payload,
        },
      };
    case "start_session":
      return {
        ...state,
        deck: {
          ...state.deck,
          locked: true,
        },
        activeSession: {
          agentId: action.payload.agentId,
          status: action.payload.status,
          startedAt: action.payload.startedAt || state.activeSession.startedAt || new Date().toISOString(),
        },
      };
    case "session_status":
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          agentId: action.payload.agentId || state.activeSession.agentId,
          status: action.payload.status,
        },
      };
    case "finish_session":
      return {
        ...state,
        deck: {
          ...state.deck,
          locked: false,
        },
        activeSession: {
          ...initialState.activeSession,
        },
        reports: {
          ...state.reports,
          [action.payload.agentId]: action.payload.report,
        },
      };
    case "end_session":
      return {
        ...state,
        deck: {
          ...state.deck,
          locked: false,
        },
        activeSession: {
          ...initialState.activeSession,
        },
      };
    case "rate_report":
      return {
        ...state,
        reports: {
          ...state.reports,
          [action.payload.agentId]: {
            ...(state.reports[action.payload.agentId] || {}),
            rating: action.payload.rating,
          },
        },
      };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        dispatch({
          type: "hydrate",
          payload: JSON.parse(stored),
        });
      }
    } catch (_error) {}

    setHydrated(true);

    const handleStorage = (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) {
        return;
      }

      try {
        dispatch({
          type: "sync_state",
          payload: JSON.parse(event.newValue),
        });
      } catch (_error) {}
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    document.documentElement.dataset.theme = state.theme;
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    console.log("[PitchMirror][AppState] active session changed", state.activeSession);
  }, [hydrated, state.activeSession]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (state.activeSession.status === "idle") {
        return;
      }

      const heartbeat = readSessionHeartbeat();
      const startedAt = Date.parse(state.activeSession.startedAt || "");
      const inStartupGrace =
        Number.isFinite(startedAt) &&
        Date.now() - startedAt < SESSION_STARTUP_GRACE_MS;

      if (isSessionHeartbeatFresh(heartbeat) || inStartupGrace) {
        return;
      }

      console.log("[PitchMirror][AppState] stale heartbeat detected; ending session", {
        activeSession: state.activeSession,
        heartbeat,
      });
      clearSessionHeartbeat(state.activeSession.agentId);
      dispatch({ type: "end_session" });
    }, 1500);

    return () => window.clearInterval(intervalId);
  }, [hydrated, state.activeSession]);

  const actions = useMemo(
    () => ({
      setTheme(nextTheme) {
        dispatch({ type: "set_theme", payload: nextTheme });
      },
      setCredentials(payload) {
        dispatch({ type: "set_credentials", payload });
      },
      setCustomBrief(value) {
        dispatch({ type: "set_custom_brief", payload: value });
      },
      beginUpload() {
        dispatch({ type: "upload_pending" });
      },
      completeUpload(payload) {
        dispatch({ type: "upload_success", payload });
      },
      failUpload(message) {
        dispatch({ type: "upload_failure", payload: message });
      },
      startSession(agentId, status = "launching") {
        dispatch({
          type: "start_session",
          payload: {
            agentId,
            status,
            startedAt: new Date().toISOString(),
          },
        });
      },
      setSessionStatus(agentId, status) {
        dispatch({
          type: "session_status",
          payload: { agentId, status },
        });
      },
      finishSession(agentId, report) {
        clearSessionHeartbeat(agentId);
        dispatch({
          type: "finish_session",
          payload: { agentId, report },
        });
      },
      endSession() {
        clearSessionHeartbeat();
        dispatch({ type: "end_session" });
      },
      rateConversation(agentId, rating) {
        dispatch({
          type: "rate_report",
          payload: { agentId, rating },
        });
      },
    }),
    []
  );

  const value = useMemo(
    () => ({
      state,
      actions,
      hydrated,
    }),
    [actions, hydrated, state]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used inside AppProvider.");
  }

  return context;
}
