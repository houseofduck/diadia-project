import { API_CONFIG } from "../config";
import { ResearchV2Request } from "../types/research.types";
import { ParsedSSEEvent, StreamOptions } from "../types/events.types";
import { parseSSEStream, createStreamController } from "../utils/sse-parser";
import { generateSessionKey } from "../utils/session";

const activeStreams = new Map<string, AbortController>();

function combineSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", () => controller.abort());
  }

  return controller.signal;
}

export async function streamResearchV2(
  request: ResearchV2Request,
  options: StreamOptions = {}
): Promise<{
  sessionKey: string;
  events: ParsedSSEEvent[];
  report?: string;
}> {
  const sessionKey = generateSessionKey();
  const { controller, signal } = createStreamController();

  activeStreams.set(sessionKey, controller);

  const events: ParsedSSEEvent[] = [];
  let report: string | undefined;

  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RESEARCH_V2}`, {
      method: "POST",
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify(request),
      signal: options.signal ? combineSignals([signal, options.signal]) : signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    options.onStart?.(sessionKey);

    const reader = response.body.getReader();

    for await (const event of parseSSEStream(reader)) {
      events.push(event);

      if (event.type === "completed") {
        report = event.report || (event.data as { report?: string })?.report;
      }

      if (event.type === "error") {
        const error = new Error(event.error || event.description || "Unknown error");
        options.onError?.(error);
      }

      options.onEvent?.(event);
    }

    options.onComplete?.();
  } catch (error) {
    if (error instanceof Error) {
      options.onError?.(error);

      if (error.name !== "AbortError") {
        throw error;
      }
    }
  } finally {
    activeStreams.delete(sessionKey);
  }

  return { sessionKey, events, report };
}

export async function researchWithStrategy(
  prompt: string,
  strategyId?: string,
  strategyContent?: string
): Promise<string> {
  const result = await streamResearchV2(
    {
      prompt,
      strategy_id: strategyId,
      strategy_content: strategyContent,
    },
    {
      onEvent: (event) => {
        console.log(`[FrameV4][${event.type}]`, event.description || "");
      },
    }
  );

  return result.report || result.sessionKey;
}

export async function researchWithCustomStrategy(
  prompt: string,
  customStrategy: string
): Promise<string> {
  return researchWithStrategy(prompt, "custom", customStrategy);
}

export function cancelResearch(sessionKey: string): boolean {
  const controller = activeStreams.get(sessionKey);
  if (controller) {
    controller.abort();
    activeStreams.delete(sessionKey);
    return true;
  }
  return false;
}

export function getActiveStreams(): string[] {
  return Array.from(activeStreams.keys());
}

// Example custom strategies
export const RESEARCH_STRATEGIES = {
  COMPREHENSIVE: `
    1. Start with a broad overview of the topic
    2. Identify key subtopics and areas of interest
    3. Deep dive into each subtopic with targeted searches
    4. Find recent developments and cutting-edge research
    5. Synthesize findings into a comprehensive report
  `,

  TECHNICAL: `
    1. Focus on technical specifications and implementation details
    2. Search for code examples and best practices
    3. Identify common pitfalls and solutions
    4. Compare different approaches and technologies
    5. Provide actionable technical recommendations
  `,

  MARKET_ANALYSIS: `
    1. Analyze market size and growth trends
    2. Identify key players and competitors
    3. Evaluate market opportunities and threats
    4. Assess customer needs and pain points
    5. Provide strategic market insights
  `,

  ACADEMIC: `
    1. Search for peer-reviewed papers and citations
    2. Identify seminal works and key researchers
    3. Analyze methodologies and findings
    4. Evaluate the current state of research
    5. Suggest future research directions
  `,
} as const;
