import { http, HttpResponse } from 'msw';
import { API_CONFIG } from '../../config';

export const handlers = [
  // Research API endpoint
  http.post(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RESEARCH}`, async ({ request }) => {
    const body = await request.json() as {
      prompt: string;
      dry?: boolean;
      session_key?: string;
      start_from?: 'research' | 'reporting';
      mock_directory?: string;
    };

    // Handle dry run
    if (body.dry) {
      return createSSEResponse([
        { type: 'started', description: 'Mock research started', session_key: body.session_key || 'mock-session' },
        { type: 'progress', description: 'Mock progress update' },
        { type: 'completed', description: 'Mock research completed', report: 'Mock research report' }
      ]);
    }

    // Simulate different scenarios based on prompt
    if (body.prompt.includes('error')) {
      return createSSEResponse([
        { type: 'started', description: 'Research started', session_key: body.session_key || 'error-session' },
        { type: 'error', description: 'Mock error occurred', error: 'Simulated API error' }
      ]);
    }

    if (body.prompt.includes('timeout')) {
      // Return a response that never completes (for timeout testing)
      return createSSEResponse([
        { type: 'started', description: 'Research started', session_key: body.session_key || 'timeout-session' },
        { type: 'progress', description: 'This will hang...' }
      ], true);
    }

    if (body.prompt.includes('malformed')) {
      // Return malformed JSON to test error handling
      return new HttpResponse(
        'data: {invalid json}\ndata: {"type":"error"}\n',
        {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        }
      );
    }

    if (body.prompt.includes('network-error')) {
      return HttpResponse.error();
    }

    if (body.prompt.includes('500-error')) {
      return new HttpResponse('Internal Server Error', { status: 500 });
    }

    if (body.prompt.includes('no-body-error')) {
      return new HttpResponse(null, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    // Default successful research flow
    return createSSEResponse([
      { type: 'started', description: 'Research started', session_key: body.session_key || 'test-session' },
      { type: 'progress', description: 'Searching for information...' },
      { type: 'progress', description: 'Analyzing sources...' },
      { type: 'research_complete', description: 'Research phase completed' },
      { type: 'reporting_started', description: 'Generating report...' },
      { type: 'completed', description: 'Research completed successfully', report: `Research report for: ${body.prompt}` }
    ]);
  }),

  // Research V2 API endpoint
  http.post(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RESEARCH_V2}`, async ({ request }) => {
    const body = await request.json() as {
      prompt: string;
      strategy_id?: string;
      strategy_content?: string;
    };

    // Handle different strategies
    if (body.strategy_id === 'custom' && body.strategy_content?.includes('technical')) {
      return createSSEResponse([
        { type: 'started', description: 'Technical research started with custom strategy' },
        { type: 'progress', description: 'Using custom technical analysis strategy...' },
        { type: 'completed', description: 'Technical research completed', report: `Technical analysis report for: ${body.prompt}` }
      ]);
    }

    // Default V2 flow
    return createSSEResponse([
      { type: 'started', description: 'Frame V4 research started' },
      { type: 'progress', description: 'Applying advanced research strategy...' },
      { type: 'completed', description: 'Advanced research completed', report: `Advanced research report for: ${body.prompt}` }
    ]);
  }),

  // Health check endpoint
  http.get(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.HEALTH}`, () => {
    return HttpResponse.json({ status: 'ok', message: 'Research API is running' });
  }),

  // Error handlers for different HTTP status codes
  http.post(`${API_CONFIG.BASE_URL}/api/research/500`, () => {
    return new HttpResponse(null, { status: 500 });
  }),

  http.post(`${API_CONFIG.BASE_URL}/api/research/404`, () => {
    return new HttpResponse(null, { status: 404 });
  }),

  http.post(`${API_CONFIG.BASE_URL}/api/research/network-error`, () => {
    return HttpResponse.error();
  }),
];

// Helper function to create SSE responses
function createSSEResponse(events: Array<Record<string, unknown>>, hang = false): HttpResponse {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      let eventIndex = 0;
      
      const sendNextEvent = () => {
        if (eventIndex >= events.length) {
          if (!hang) {
            controller.close();
          }
          return;
        }
        
        const event = events[eventIndex++];
        const eventData = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(eventData));
        
        // Send next event after a short delay to simulate streaming
        setTimeout(sendNextEvent, 50);
      };
      
      // Start sending events
      sendNextEvent();
    }
  });

  return new HttpResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}