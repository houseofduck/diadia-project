import { API_CONFIG, SSE_CONFIG } from "../config";
import {
  ResearchRequest,
  ResearchSession,
  SSEEvent,
  SessionStatus,
  EventType,
} from "../types/research.types";
import { ParsedSSEEvent, StreamOptions } from "../types/events.types";
import { parseSSEStream, createStreamController } from "../utils/sse-parser";
import { generateSessionKey, saveSession, getSession } from "../utils/session";

const activeStreams = new Map<string, AbortController>();

function parseEventToSSE(event: ParsedSSEEvent): SSEEvent {
  return {
    type: event.type as EventType,
    description: event.description,
    data: event.data || event,
    timestamp: new Date(),
    raw: JSON.stringify(event),
  };
}

function combineSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    signal.addEventListener("abort", () => controller.abort());
  }

  return controller.signal;
}

export async function streamResearch(
  request: ResearchRequest,
  options: StreamOptions = {}
): Promise<string> {
  const sessionKey = request.session_key || generateSessionKey();
  const { controller, signal } = createStreamController();

  // Combine abort signals if one is provided
  const combinedSignal = options.signal ? combineSignals([signal, options.signal]) : signal;

  // Store the controller for cancellation
  activeStreams.set(sessionKey, controller);

  const session: ResearchSession = {
    sessionKey,
    prompt: request.prompt,
    startedAt: new Date(),
    events: [],
    status: "submitting" as SessionStatus,
  };

  await saveSession(sessionKey, session);

  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RESEARCH}`, {
      method: "POST",
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify({
        ...request,
        session_key: sessionKey,
      }),
      signal: combinedSignal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    session.status = "streaming";
    await saveSession(sessionKey, session);

    // Process the stream
    const reader = response.body.getReader();

    for await (const event of parseSSEStream(reader)) {
      // Handle different event types
      const sseEvent = parseEventToSSE(event);
      session.events.push(sseEvent);

      // Update session status based on event type
      switch (event.type) {
        case "started":
          options.onStart?.(event.session_key || sessionKey);
          break;

        case "completed":
          session.status = "completed";
          session.completedAt = new Date();
          session.report = event.report || (event.data as { report?: string })?.report;
          break;

        case "error":
          session.status = "error";
          session.error = event.error || event.description;
          options.onError?.(new Error(session.error));
          break;
      }

      await saveSession(sessionKey, session);

      // Notify callback
      options.onEvent?.(event);
    }

    if (session.status === "streaming") {
      session.status = "completed";
      session.completedAt = new Date();
    }

    await saveSession(sessionKey, session);
    options.onComplete?.();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        session.status = "cancelled";
      } else {
        session.status = "error";
        session.error = error.message;
        options.onError?.(error);
      }
    }

    await saveSession(sessionKey, session);
    throw error;
  } finally {
    activeStreams.delete(sessionKey);
  }

  return sessionKey;
}

export async function simpleResearch(
  prompt: string,
  startFrom: "research" | "reporting" = "research"
): Promise<string> {
  const events: ParsedSSEEvent[] = [];
  let report = "";

  const sessionKey = await streamResearch(
    {
      prompt,
      start_from: startFrom,
    },
    {
      onEvent: (event) => {
        events.push(event);
        console.log(`[${event.type}]`, event.description || "");

        if (event.type === "completed" && event.report) {
          report = event.report as string;
        }
      },
      onError: (error) => {
        console.error("Research error:", error);
      },
    }
  );

  return report || sessionKey;
}

export async function dryRun(prompt: string, mockDirectory?: string): Promise<string> {
  return streamResearch(
    {
      dry: true,
      prompt,
      mock_directory: mockDirectory,
      start_from: "research",
    },
    {
      onEvent: (event) => {
        console.log(`[DRY RUN][${event.type}]`, event.description || "");
      },
    }
  );
}

export async function cancelResearch(sessionKey: string): Promise<boolean> {
  const controller = activeStreams.get(sessionKey);
  if (controller) {
    controller.abort();
    activeStreams.delete(sessionKey);

    const session = await getSession(sessionKey);
    if (session) {
      session.status = "cancelled";
      await saveSession(sessionKey, session);
    }

    return true;
  }
  return false;
}

export async function cancelAllResearch(): Promise<void> {
  for (const [sessionKey, controller] of activeStreams) {
    controller.abort();

    const session = await getSession(sessionKey);
    if (session) {
      session.status = "cancelled";
      await saveSession(sessionKey, session);
    }
  }
  activeStreams.clear();
}

export function getActiveStreams(): string[] {
  return Array.from(activeStreams.keys());
}

export function isStreamActive(sessionKey: string): boolean {
  return activeStreams.has(sessionKey);
}

export async function retryResearch(
  sessionKey: string,
  retryAttempts = SSE_CONFIG.RETRY_ATTEMPTS
): Promise<string> {
  const session = await getSession(sessionKey);
  if (!session) {
    throw new Error(`Session ${sessionKey} not found`);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retryAttempts; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, SSE_CONFIG.RETRY_DELAY * Math.pow(2, attempt))
        );
      }

      return await streamResearch({
        prompt: session.prompt,
        session_key: sessionKey,
        start_from: "research", // Default since lastPhase doesn't exist on ResearchSession
      });
    } catch (error) {
      lastError = error as Error;
      console.error(`Retry attempt ${attempt + 1} failed:`, error);
    }
  }

  throw lastError || new Error("All retry attempts failed");
}
