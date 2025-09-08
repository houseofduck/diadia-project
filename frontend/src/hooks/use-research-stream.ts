"use client";

import { useReducer, useCallback, useRef, useEffect } from "react";
import {
  streamResearch,
  cancelResearch,
  generateSessionKey,
  saveSession,
  type SessionStatus,
  type SSEEvent,
  type ResearchRequest,
  type ResearchSession,
} from "../services";
import { useSession } from "../context/session-context";

// State machine types
export interface ResearchStreamState {
  status: SessionStatus;
  events: SSEEvent[];
  error: string | null;
  report: string | null;
  isOnline: boolean;
  lastRequest: { prompt: string; options?: Partial<ResearchRequest> } | null;
}

// Action types for the state machine
export type ResearchStreamAction =
  | { type: "START_REQUEST"; payload: { prompt: string; options?: Partial<ResearchRequest> } }
  | { type: "SET_SUBMITTING" }
  | { type: "SET_STREAMING" }
  | { type: "ADD_EVENT"; payload: SSEEvent }
  | { type: "SET_ERROR"; payload: string }
  | { type: "SET_REPORT"; payload: string }
  | { type: "SET_COMPLETED" }
  | { type: "SET_CANCELLED" }
  | { type: "SET_OFFLINE" }
  | { type: "SET_ONLINE" }
  | { type: "RESET" };

// Initial state
const initialState: ResearchStreamState = {
  status: "idle",
  events: [],
  error: null,
  report: null,
  isOnline: true,
  lastRequest: null,
};

// State machine reducer
function researchStreamReducer(
  state: ResearchStreamState,
  action: ResearchStreamAction
): ResearchStreamState {
  switch (action.type) {
    case "START_REQUEST":
      return {
        ...state,
        status: "submitting",
        events: [],
        error: null,
        report: null,
        lastRequest: action.payload,
      };

    case "SET_SUBMITTING":
      return {
        ...state,
        status: "submitting",
      };

    case "SET_STREAMING":
      return {
        ...state,
        status: "streaming",
      };

    case "ADD_EVENT":
      return {
        ...state,
        events: [...state.events, action.payload],
      };

    case "SET_ERROR":
      return {
        ...state,
        status: "error",
        error: action.payload,
      };

    case "SET_REPORT":
      return {
        ...state,
        report: action.payload,
      };

    case "SET_COMPLETED":
      return {
        ...state,
        status: "completed",
      };

    case "SET_CANCELLED":
      return {
        ...state,
        status: "cancelled",
      };

    case "SET_OFFLINE":
      return {
        ...state,
        isOnline: false,
        status: state.status === "streaming" ? "offline" : state.status,
      };

    case "SET_ONLINE":
      return {
        ...state,
        isOnline: true,
        status: state.status === "offline" ? "idle" : state.status,
      };

    case "RESET":
      return {
        ...initialState,
        isOnline: state.isOnline,
      };

    default:
      return state;
  }
}

export interface UseResearchStreamActions {
  start: (prompt: string, options?: Partial<ResearchRequest>) => Promise<void>;
  cancel: () => void;
  retry: () => void;
  reset: () => void;
  restoreSession: (session: ResearchSession) => void;
}

export interface UseResearchStreamReturn extends ResearchStreamState, UseResearchStreamActions {
  sessionKey: string | null;
}

export function useResearchStream(): UseResearchStreamReturn {
  const { sessionKey, setSessionKey, clearSession } = useSession();
  const [state, dispatch] = useReducer(researchStreamReducer, initialState);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => dispatch({ type: "SET_ONLINE" });
    const handleOffline = () => dispatch({ type: "SET_OFFLINE" });

    if (typeof window !== "undefined") {
      // Set initial online status
      if (!navigator.onLine) {
        dispatch({ type: "SET_OFFLINE" });
      }

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  // Keep track of whether we're in restoration mode
  const restoringRef = useRef(false);

  // Save session state whenever it changes
  useEffect(() => {
    const saveSessionState = async () => {
      if (!sessionKey || !state.lastRequest || restoringRef.current) return;

      const sessionData: ResearchSession = {
        sessionKey,
        prompt: state.lastRequest.prompt,
        startedAt: new Date(), // This should be more accurate, but for now...
        status: state.status,
        events: state.events,
        report: state.report || undefined,
        error: state.error || undefined,
      };

      try {
        await saveSession(sessionKey, sessionData);
        console.log("Saved session state:", state.status, state.events.length);
      } catch (err) {
        console.error("Failed to save session:", err);
      }
    };

    // Only save if we have meaningful state changes and we're not restoring
    if (state.status !== "idle" && sessionKey && !restoringRef.current) {
      saveSessionState();
    }
  }, [sessionKey, state.status, state.events, state.report, state.error, state.lastRequest]);

  const start = useCallback(
    async (prompt: string, options: Partial<ResearchRequest> = {}) => {
      console.log("START called with:", {
        prompt,
        options,
        isOnline: state.isOnline,
        status: state.status,
      });

      if (!state.isOnline) {
        dispatch({ type: "SET_ERROR", payload: "No internet connection available" });
        return;
      }

      // Start the request - this clears previous state and stores the request
      dispatch({ type: "START_REQUEST", payload: { prompt, options } });

      // Generate session key if not provided
      const currentSessionKey = options.session_key || sessionKey || generateSessionKey();
      console.log("Using session key:", currentSessionKey);
      setSessionKey(currentSessionKey);

      const request: ResearchRequest = {
        prompt,
        start_from: "research",
        ...options,
        session_key: currentSessionKey,
      };

      try {
        dispatch({ type: "SET_STREAMING" });
        console.log("About to call streamResearch with request:", request);

        await streamResearch(request, {
          onEvent: (event) => {
            const sseEvent: SSEEvent = {
              id: event.session_key,
              type: (event.type as any) || "generic",
              description: event.description,
              data: event.data,
              timestamp: new Date(),
              raw: JSON.stringify(event),
            };

            dispatch({ type: "ADD_EVENT", payload: sseEvent });

            // Handle specific event types
            switch (sseEvent.type) {
              case "error":
                const errorMessage =
                  sseEvent.description ||
                  (typeof sseEvent.data === "object" && sseEvent.data && "message" in sseEvent.data
                    ? (sseEvent.data as any).message
                    : null) ||
                  "An error occurred";
                dispatch({
                  type: "SET_ERROR",
                  payload: errorMessage,
                });
                break;

              case "report_done":
                // Extract report from report_done event
                if (event.report) {
                  dispatch({ type: "SET_REPORT", payload: event.report });
                } else if (
                  sseEvent.data &&
                  typeof sseEvent.data === "object" &&
                  "report" in sseEvent.data
                ) {
                  dispatch({
                    type: "SET_REPORT",
                    payload: (sseEvent.data as { report: string }).report,
                  });
                }
                break;

              case "completed":
                // Just mark as completed - report should already be set from report_done
                dispatch({ type: "SET_COMPLETED" });
                break;

              case "cancelled":
                dispatch({ type: "SET_CANCELLED" });
                break;
            }
          },
          onError: (error) => {
            dispatch({
              type: "SET_ERROR",
              payload: error.message || "An unknown error occurred",
            });
          },
          onComplete: () => {
            if (state.status === "streaming") {
              dispatch({ type: "SET_COMPLETED" });
            }
          },
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
        dispatch({ type: "SET_ERROR", payload: errorMessage });
      }
    },
    [state.isOnline, state.status, sessionKey, setSessionKey]
  );

  const cancel = useCallback(() => {
    if (sessionKey) {
      cancelResearch(sessionKey);
    }
    dispatch({ type: "SET_CANCELLED" });
  }, [sessionKey]);

  const retry = useCallback(async () => {
    if (state.lastRequest) {
      await start(state.lastRequest.prompt, state.lastRequest.options);
    }
  }, [state.lastRequest, start]);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
    clearSession();
  }, [clearSession]);

  const restoreSession = useCallback(
    (session: ResearchSession) => {
      console.log("Restoring session in hook:", session.sessionKey, session.status);

      // Set restoration mode to prevent auto-saving during restore
      restoringRef.current = true;

      // Set the session key in context first
      setSessionKey(session.sessionKey);

      // Restore the base state without starting a request
      dispatch({ type: "RESET" });

      // Set the last request for retry functionality
      dispatch({
        type: "START_REQUEST",
        payload: {
          prompt: session.prompt,
          options: { session_key: session.sessionKey },
        },
      });

      // Add all events
      session.events.forEach((event) => {
        dispatch({ type: "ADD_EVENT", payload: event });
      });

      // Set final state based on session status
      if (session.status === "completed") {
        if (session.report) {
          dispatch({ type: "SET_REPORT", payload: session.report });
        }
        dispatch({ type: "SET_COMPLETED" });
      } else if (session.status === "error" && session.error) {
        dispatch({ type: "SET_ERROR", payload: session.error });
      } else if (session.status === "cancelled") {
        dispatch({ type: "SET_CANCELLED" });
      } else if (session.status === "streaming") {
        dispatch({ type: "SET_STREAMING" });
      } else if (session.status === "submitting") {
        dispatch({ type: "SET_SUBMITTING" });
      }

      // Reset restoration mode after a short delay
      setTimeout(() => {
        restoringRef.current = false;
      }, 500);

      console.log("Session restoration completed");
    },
    [setSessionKey]
  );

  return {
    // State from reducer
    ...state,
    sessionKey,

    // Actions
    start,
    cancel,
    retry,
    reset,
    restoreSession,
  };
}
