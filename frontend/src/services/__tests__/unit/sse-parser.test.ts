import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createSSEParser, 
  parseSSEStream, 
  createStreamController 
} from '../../utils/sse-parser';

describe('SSE Parser', () => {
  describe('createSSEParser', () => {
    let parser: ReturnType<typeof createSSEParser>;

    beforeEach(() => {
      parser = createSSEParser();
    });

    it('should parse complete JSON objects', () => {
      const events = parser.parseChunk('{"type":"test","data":"value"}\n');
      
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'test',
        data: 'value'
      });
    });

    it('should parse SSE data: format', () => {
      const events = parser.parseChunk('data: {"type":"started","description":"Research started"}\n');
      
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'started',
        description: 'Research started'
      });
    });

    it('should handle multiple events in one chunk', () => {
      const chunk = `{"type":"event1","data":"first"}
{"type":"event2","data":"second"}
`;
      const events = parser.parseChunk(chunk);
      
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('event1');
      expect(events[1].type).toBe('event2');
    });

    it('should buffer incomplete chunks', () => {
      // First chunk - incomplete JSON
      let events = parser.parseChunk('{"type":"test",');
      expect(events).toHaveLength(0);

      // Second chunk - completes the JSON
      events = parser.parseChunk('"data":"value"}\n');
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'test',
        data: 'value'
      });
    });

    it('should handle mixed SSE and NDJSON formats', () => {
      const chunk = `data: {"type":"sse","msg":"hello"}
{"type":"ndjson","msg":"world"}
`;
      const events = parser.parseChunk(chunk);
      
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('sse');
      expect(events[1].type).toBe('ndjson');
    });

    it('should ignore SSE comments and metadata', () => {
      const chunk = `: this is a comment
event: test-event
id: 123
data: {"type":"actual","data":"content"}

`;
      const events = parser.parseChunk(chunk);
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('actual');
    });

    it('should handle [DONE] termination signal', () => {
      const events = parser.parseChunk('data: [DONE]\n');
      expect(events).toHaveLength(0);
    });

    it('should flush remaining buffer content', () => {
      parser.parseChunk('{"type":"test"');
      
      const events = parser.flush();
      expect(events).toHaveLength(0); // Incomplete JSON should be ignored
    });

    it('should reset buffer state', () => {
      parser.parseChunk('{"incomplete":');
      parser.reset();
      
      const events = parser.parseChunk('{"type":"complete"}\n');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('complete');
    });

    it('should throw SSEParseError for malformed JSON', () => {
      expect(() => {
        parser.parseChunk('data: {invalid json}\n');
      }).toThrow('Failed to parse SSE event');
    });

    it('should handle empty lines gracefully', () => {
      const events = parser.parseChunk('\n\n\n{"type":"test"}\n\n');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('test');
    });
  });

  describe('parseSSEStream', () => {
    function createMockReader(chunks: string[]) {
      let index = 0;
      return {
        read: async () => {
          if (index >= chunks.length) {
            return { done: true, value: undefined };
          }
          const chunk = new TextEncoder().encode(chunks[index++]);
          return { done: false, value: chunk };
        },
        releaseLock: () => {}
      } as ReadableStreamDefaultReader<Uint8Array>;
    }

    it('should parse complete stream', async () => {
      const chunks = [
        '{"type":"started"}\n',
        '{"type":"progress","data":"50%"}\n',
        '{"type":"completed","report":"Done"}\n'
      ];
      
      const reader = createMockReader(chunks);
      const events = [];
      
      for await (const event of parseSSEStream(reader)) {
        events.push(event);
      }
      
      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('started');
      expect(events[1].type).toBe('progress');
      expect(events[2].type).toBe('completed');
    });

    it('should handle partial chunks across reads', async () => {
      const chunks = [
        '{"type":"test",',
        '"data":"split',
        ' across chunks"}\n'
      ];
      
      const reader = createMockReader(chunks);
      const events = [];
      
      for await (const event of parseSSEStream(reader)) {
        events.push(event);
      }
      
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'test',
        data: 'split across chunks'
      });
    });

    it('should flush final events on stream end', async () => {
      const chunks = [
        '{"type":"complete","data":"final"}'
      ]; // No newline - should be flushed
      
      const reader = createMockReader(chunks);
      const events = [];
      
      for await (const event of parseSSEStream(reader)) {
        events.push(event);
      }
      
      expect(events).toHaveLength(1); // Should be 1 because this is complete JSON that gets flushed
      expect(events[0]).toEqual({
        type: 'complete',
        data: 'final'
      });
    });
  });

  describe('createStreamController', () => {
    it('should create working abort controller', () => {
      const { controller, signal, abort, isAborted } = createStreamController();
      
      expect(controller).toBeInstanceOf(AbortController);
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(typeof abort).toBe('function');
      expect(typeof isAborted).toBe('function');
      
      expect(isAborted()).toBe(false);
      expect(signal.aborted).toBe(false);
    });

    it('should abort correctly', () => {
      const { signal, abort, isAborted } = createStreamController();
      
      abort();
      
      expect(isAborted()).toBe(true);
      expect(signal.aborted).toBe(true);
    });

    it('should trigger abort event listeners', () => {
      const { signal, abort } = createStreamController();
      let aborted = false;
      
      signal.addEventListener('abort', () => {
        aborted = true;
      });
      
      abort();
      expect(aborted).toBe(true);
    });
  });
});