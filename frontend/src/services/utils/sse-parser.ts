import { ParsedSSEEvent, SSEParseError } from '../types/events.types';

type ParserState = {
  buffer: string;
};

export function createSSEParser() {
  const state: ParserState = { buffer: '' };

  const parseChunk = (chunk: string): ParsedSSEEvent[] => {
    state.buffer += chunk;
    const lines = state.buffer.split('\n');
    const events: ParsedSSEEvent[] = [];
    
    // Keep the last incomplete line in the buffer
    state.buffer = lines[lines.length - 1];
    
    // Process all complete lines
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('data: ')) {
        const jsonStr = line.substring(6);
        
        if (jsonStr === '[DONE]') {
          continue;
        }
        
        try {
          const parsed = JSON.parse(jsonStr);
          // Handle backend format: {"event": {...}, "session_key": "..."}
          const event = parsed.event ? parsed.event as ParsedSSEEvent : parsed as ParsedSSEEvent;
          if (parsed.session_key) {
            event.session_key = parsed.session_key;
          }
          events.push(event);
        } catch (error) {
          // Try to parse as NDJSON (newline-delimited JSON)
          if (jsonStr.trim()) {
            throw new SSEParseError(
              `Failed to parse SSE event: ${jsonStr}`,
              jsonStr,
              error as Error
            );
          }
        }
      } else if (line && !line.startsWith(':')) {
        // Try to parse as plain NDJSON
        try {
          const parsed = JSON.parse(line);
          // Handle backend format: {"event": {...}, "session_key": "..."}
          const event = parsed.event ? parsed.event as ParsedSSEEvent : parsed as ParsedSSEEvent;
          if (parsed.session_key) {
            event.session_key = parsed.session_key;
          }
          events.push(event);
        } catch (error) {
          // Ignore non-JSON lines (could be SSE comments or empty lines)
          if (line.trim() && !line.startsWith('event:') && !line.startsWith('id:')) {
            console.warn('Skipping non-JSON line:', line);
          }
        }
      }
    }
    
    return events;
  };
  
  const flush = (): ParsedSSEEvent[] => {
    if (!state.buffer.trim()) {
      return [];
    }
    
    const events: ParsedSSEEvent[] = [];
    
    try {
      // Try to parse any remaining buffer content
      if (state.buffer.startsWith('data: ')) {
        const jsonStr = state.buffer.substring(6);
        if (jsonStr !== '[DONE]') {
          const parsed = JSON.parse(jsonStr);
          const event = parsed.event ? parsed.event as ParsedSSEEvent : parsed as ParsedSSEEvent;
          if (parsed.session_key) {
            event.session_key = parsed.session_key;
          }
          events.push(event);
        }
      } else {
        const parsed = JSON.parse(state.buffer);
        const event = parsed.event ? parsed.event as ParsedSSEEvent : parsed as ParsedSSEEvent;
        if (parsed.session_key) {
          event.session_key = parsed.session_key;
        }
        events.push(event);
      }
    } catch (error) {
      // Buffer might be incomplete, ignore
    }
    
    state.buffer = '';
    return events;
  };
  
  const reset = (): void => {
    state.buffer = '';
  };

  return {
    parseChunk,
    flush,
    reset,
  };
}

export async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<ParsedSSEEvent, void, unknown> {
  const decoder = new TextDecoder();
  const parser = createSSEParser();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // Flush any remaining events
        const events = parser.flush();
        for (const event of events) {
          yield event;
        }
        break;
      }
      
      const chunk = decoder.decode(value, { stream: true });
      const events = parser.parseChunk(chunk);
      
      for (const event of events) {
        yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function createStreamController(): {
  controller: AbortController;
  signal: AbortSignal;
  abort: () => void;
  isAborted: () => boolean;
} {
  const controller = new AbortController();
  
  return {
    controller,
    signal: controller.signal,
    abort: () => controller.abort(),
    isAborted: () => controller.signal.aborted,
  };
}