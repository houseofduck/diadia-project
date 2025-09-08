import type { ParsedSSEEvent } from '../../types/events.types';

export const mockSSEResponses = {
  // Successful research flow
  successfulResearch: [
    { type: 'started', description: 'Research started', session_key: 'test-session-123' },
    { type: 'progress', description: 'Searching for information...', data: { progress: 25 } },
    { type: 'progress', description: 'Analyzing sources...', data: { progress: 50 } },
    { type: 'progress', description: 'Extracting insights...', data: { progress: 75 } },
    { type: 'research_complete', description: 'Research phase completed' },
    { type: 'reporting_started', description: 'Generating report...' },
    { type: 'progress', description: 'Formatting results...', data: { progress: 90 } },
    { 
      type: 'completed', 
      description: 'Research completed successfully',
      report: 'This is a comprehensive research report with detailed findings and analysis.',
      data: { 
        duration_ms: 5000,
        tokens_used: 1250,
        sources_found: 15 
      }
    }
  ] as ParsedSSEEvent[],

  // Error during research
  researchError: [
    { type: 'started', description: 'Research started', session_key: 'error-session-456' },
    { type: 'progress', description: 'Searching for information...', data: { progress: 25 } },
    { 
      type: 'error', 
      description: 'Failed to fetch search results',
      error: 'API rate limit exceeded',
      data: { 
        code: 'RATE_LIMIT_ERROR',
        retryAfter: 60 
      }
    }
  ] as ParsedSSEEvent[],

  // Quick dry run response
  dryRunResponse: [
    { type: 'started', description: 'Dry run started', session_key: 'dry-run-789' },
    { type: 'progress', description: 'Using mock data...' },
    { 
      type: 'completed', 
      description: 'Dry run completed',
      report: 'Mock research report generated from test data.'
    }
  ] as ParsedSSEEvent[],

  // Frame V4 research response
  frameV4Response: [
    { type: 'started', description: 'Frame V4 research initiated' },
    { type: 'progress', description: 'Applying custom research strategy...' },
    { type: 'progress', description: 'Deep analysis in progress...' },
    { 
      type: 'completed', 
      description: 'Advanced research completed',
      report: 'Advanced Frame V4 research report with enhanced analysis capabilities.'
    }
  ] as ParsedSSEEvent[],

  // Malformed responses for error testing
  malformedResponse: [
    'data: {invalid json content}\n',
    'data: {"type":"started","desc', // Incomplete
    'iption":"test"}\n',
    'invalid line without data prefix\n',
    'data: [DONE]\n'
  ],

  // Large response for performance testing
  largeResponse: Array.from({ length: 100 }, (_, i) => ({
    type: 'progress',
    description: `Progress update ${i + 1}/100`,
    data: { 
      progress: i + 1,
      details: `Step ${i + 1}: ${'x'.repeat(1000)}` // Large data payload
    }
  })).concat([
    {
      type: 'completed',
      description: 'Large research completed',
      report: 'x'.repeat(50000) // 50KB report
    }
  ]) as ParsedSSEEvent[],

  // Slow response for timeout testing  
  slowResponse: [
    { type: 'started', description: 'Slow research started' },
    // This would be sent with large delays in tests
    { type: 'progress', description: 'This takes a while...' },
    { type: 'completed', description: 'Finally done', report: 'Slow report' }
  ] as ParsedSSEEvent[],
};

// Helper to convert events to SSE format
export function eventsToSSE(events: ParsedSSEEvent[]): string {
  return events
    .map(event => `data: ${JSON.stringify(event)}\n`)
    .join('\n') + '\n';
}

// Helper to create streaming chunks (for testing partial parsing)
export function createStreamingChunks(events: ParsedSSEEvent[], chunkSize = 50): string[] {
  const sseString = eventsToSSE(events);
  const chunks: string[] = [];
  
  for (let i = 0; i < sseString.length; i += chunkSize) {
    chunks.push(sseString.slice(i, i + chunkSize));
  }
  
  return chunks;
}

// Create a mock ReadableStream for testing
export function createMockStream(events: ParsedSSEEvent[], delay = 10): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let eventIndex = 0;
  
  return new ReadableStream({
    start(controller) {
      const sendNextEvent = () => {
        if (eventIndex >= events.length) {
          controller.close();
          return;
        }
        
        const event = events[eventIndex++];
        const chunk = encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
        controller.enqueue(chunk);
        
        setTimeout(sendNextEvent, delay);
      };
      
      sendNextEvent();
    }
  });
}

// Create a mock Response with streaming body
export function createMockResponse(events: ParsedSSEEvent[], options: {
  status?: number;
  delay?: number;
  headers?: Record<string, string>;
} = {}): Response {
  const { status = 200, delay = 10, headers = {} } = options;
  
  const stream = createMockStream(events, delay);
  
  return new Response(stream, {
    status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      ...headers
    }
  });
}