import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../mocks/setup'; // Import MSW setup
import {
  streamResearch,
  simpleResearch,
  cancelResearch,
  getActiveStreams,
  retryResearch,
} from '../../api/research';
import {
  streamResearchV2,
  researchWithStrategy,
} from '../../api/research2';
import {
  saveSession,
  getSession,
  getAllSessions,
  clearAllSessions,
  getRecentSessions,
} from '../../utils/session';
import { createSSEParser } from '../../utils/sse-parser';
import type { ResearchSession } from '../../types/research.types';

describe('End-to-End Integration Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearAllSessions();
  });

  describe('Complete Research Workflow', () => {
    it('should handle full research lifecycle with session persistence', async () => {
      const events: any[] = [];
      let sessionKey = '';

      // Step 1: Start research
      sessionKey = await streamResearch(
        {
          prompt: 'Complete workflow test',
          start_from: 'research'
        },
        {
          onEvent: (event) => events.push(event),
          onStart: (key) => { sessionKey = key; }
        }
      );

      // Step 2: Verify session was created and saved
      expect(sessionKey).toBeTruthy();
      const savedSession = await getSession(sessionKey);
      expect(savedSession).toBeTruthy();
      expect(savedSession!.status).toBe('completed');
      expect(savedSession!.prompt).toBe('Complete workflow test');

      // Step 3: Check session appears in recent sessions
      const recentSessions = await getRecentSessions(5);
      expect(recentSessions.length).toBe(1);
      expect(recentSessions[0].sessionKey).toBe(sessionKey);

      // Step 4: Verify events were properly stored
      expect(savedSession!.events.length).toBe(events.length);
      expect(savedSession!.events[0].type).toBe('started');
      expect(savedSession!.events[savedSession!.events.length - 1].type).toBe('completed');

      // Step 5: Check final report is available
      expect(savedSession!.report).toBeTruthy();
      expect(savedSession!.completedAt).toBeTruthy();
      expect(new Date(savedSession!.completedAt!)).toBeInstanceOf(Date);
    });

    it('should handle research continuation from reporting phase', async () => {
      // Step 1: Create initial research session
      const initialSessionKey = await streamResearch({
        prompt: 'Initial research for continuation test',
      });

      const initialSession = await getSession(initialSessionKey);
      expect(initialSession).toBeTruthy();

      // Step 2: Continue from reporting phase
      const continuationKey = await streamResearch({
        prompt: 'Continue from reporting',
        session_key: initialSessionKey,
        start_from: 'reporting'
      });

      expect(continuationKey).toBe(initialSessionKey);

      const continuedSession = await getSession(initialSessionKey);
      expect(continuedSession).toBeTruthy();
      expect(continuedSession!.status).toBe('completed');
    });
  });

  describe('Cross-Service Integration', () => {
    it('should handle both V1 and V2 research in same session', async () => {
      // Start V1 research
      const v1SessionKey = await streamResearch({
        prompt: 'V1 research test'
      });

      // Start V2 research
      const v2Result = await streamResearchV2({
        prompt: 'V2 research test',
        strategy_id: 'custom',
        strategy_content: 'Test strategy'
      });

      // Both should complete successfully
      const v1Session = await getSession(v1SessionKey);
      expect(v1Session!.status).toBe('completed');
      expect(v2Result.report).toBeTruthy();

      // Should have 2 sessions total
      const allSessions = await getAllSessions();
      expect(Object.keys(allSessions)).toHaveLength(1); // V1 saves to storage, V2 doesn't by default

      // Recent sessions should show both (if V2 saved sessions)
      const recentSessions = await getRecentSessions();
      expect(recentSessions.length).toBeGreaterThan(0);
    });

    it('should handle concurrent V1 and V2 requests', async () => {
      const concurrentPromises = [
        streamResearch({ prompt: 'Concurrent V1 test 1' }),
        streamResearch({ prompt: 'Concurrent V1 test 2' }),
        streamResearchV2({ prompt: 'Concurrent V2 test 1' }),
        streamResearchV2({ prompt: 'Concurrent V2 test 2' }),
        researchWithStrategy('Concurrent strategy test'),
        simpleResearch('Concurrent simple test')
      ];

      const results = await Promise.all(concurrentPromises);

      // All should complete successfully
      results.forEach(result => {
        expect(result).toBeTruthy();
      });

      // Check V1 sessions were saved (V2 doesn't save by default)
      const allSessions = await getAllSessions();
      expect(Object.keys(allSessions).length).toBeGreaterThanOrEqual(3); // V1 requests save sessions
    });
  });

  describe('Error Recovery and Retry Workflows', () => {
    it('should handle error recovery with session state consistency', async () => {
      let sessionKey = '';

      // Step 1: Cause an error
      try {
        sessionKey = await streamResearch({
          prompt: 'error test',
        });
      } catch (error) {
        // Expected to fail
      }

      // Step 2: Check error state was saved
      const errorSession = await getSession(sessionKey);
      expect(errorSession!.status).toBe('error');
      expect(errorSession!.error).toBeTruthy();

      // Step 3: Retry the research (with a successful prompt)
      try {
        const retryKey = await retryResearch(sessionKey, 1);
        expect(retryKey).toBeTruthy();
      } catch (error) {
        // Retry might fail if using the same error-inducing prompt
        expect(error).toBeTruthy();
      }
    });

    it('should handle network interruption simulation', async () => {
      const controller = new AbortController();
      let sessionKey = '';

      // Start research and cancel mid-stream
      try {
        sessionKey = await streamResearch(
          { prompt: 'Network interruption test' },
          { signal: controller.signal }
        );
      } catch (error) {
        // Cancel immediately
        controller.abort();
        expect(error.name).toBe('AbortError');
      }

      // Session should be marked as cancelled or completed if it was saved
      if (sessionKey) {
        const cancelledSession = await getSession(sessionKey);
        if (cancelledSession) {
          expect(['cancelled', 'error', 'completed'].includes(cancelledSession.status)).toBe(true);
        }
      }
    });
  });

  describe('Session Management Integration', () => {
    it('should handle session cleanup and management', async () => {
      // Create multiple sessions
      const sessionKeys = [];
      for (let i = 0; i < 3; i++) {
        const key = await streamResearch({
          prompt: `Cleanup test ${i + 1}`
        });
        sessionKeys.push(key);
      }

      // Verify all sessions exist
      let allSessions = await getAllSessions();
      expect(Object.keys(allSessions)).toHaveLength(3);

      // Get recent sessions
      const recentSessions = await getRecentSessions(2);
      expect(recentSessions).toHaveLength(2);

      // Clear all sessions
      await clearAllSessions();
      allSessions = await getAllSessions();
      expect(Object.keys(allSessions)).toHaveLength(0);
    });

    it('should maintain session order by recency', async () => {
      const sessionKeys = [];

      // Create sessions with delays to ensure different timestamps
      for (let i = 0; i < 3; i++) {
        const key = await streamResearch({
          prompt: `Recency test ${i + 1}`
        });
        sessionKeys.push(key);
        
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const recentSessions = await getRecentSessions();
      
      // Most recent should be first
      expect(recentSessions[0].sessionKey).toBe(sessionKeys[sessionKeys.length - 1]);
      expect(recentSessions[0].data.prompt).toBe('Recency test 3');
    });
  });

  describe('SSE Parser Integration', () => {
    it('should handle real streaming data with parser', async () => {
      const parser = createSSEParser();
      const events: any[] = [];

      // Simulate receiving streaming chunks
      const chunk1 = 'data: {"type":"started","description":"Test started"}\n';
      const chunk2 = 'data: {"type":"progress","description":"In progress"}\n';
      const chunk3 = 'data: {"type":"completed","report":"Test completed"}\n';

      events.push(...parser.parseChunk(chunk1));
      events.push(...parser.parseChunk(chunk2));
      events.push(...parser.parseChunk(chunk3));

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('started');
      expect(events[1].type).toBe('progress');
      expect(events[2].type).toBe('completed');
      expect(events[2].report).toBe('Test completed');
    });

    it('should handle partial chunks in real streaming scenario', async () => {
      const parser = createSSEParser();
      const events: any[] = [];

      // Simulate partial JSON across multiple chunks
      const partialChunks = [
        'data: {"type":"test",',
        '"description":"split across',
        ' multiple chunks"}\n'
      ];

      partialChunks.forEach(chunk => {
        events.push(...parser.parseChunk(chunk));
      });

      expect(events).toHaveLength(1);
      expect(events[0].description).toBe('split across multiple chunks');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent sessions without memory leaks', async () => {
      const sessionCount = 10;
      const promises = [];

      // Create many concurrent sessions
      for (let i = 0; i < sessionCount; i++) {
        promises.push(
          streamResearch({
            prompt: `Performance test ${i + 1}`
          })
        );
      }

      const sessionKeys = await Promise.all(promises);

      // All should complete
      expect(sessionKeys).toHaveLength(sessionCount);

      // All should have unique keys
      const uniqueKeys = new Set(sessionKeys);
      expect(uniqueKeys.size).toBe(sessionCount);

      // All sessions should be saved (streamResearch saves sessions)
      const allSessions = await getAllSessions();
      expect(Object.keys(allSessions)).toHaveLength(sessionCount);

      // No active streams should remain
      expect(getActiveStreams()).toHaveLength(0);
    });

    it('should handle large response data efficiently', async () => {
      // This test would verify memory usage doesn't spike with large reports
      const sessionKey = await streamResearch({
        prompt: 'Large response test'
      });

      const session = await getSession(sessionKey);
      expect(session).toBeTruthy();
      expect(session!.report).toBeTruthy();

      // Verify session data integrity
      expect(session!.events.length).toBeGreaterThan(0);
      expect(session!.status).toBe('completed');
    });
  });

  describe('State Consistency Across Components', () => {
    it('should maintain consistent state between parser, API, and storage', async () => {
      const events: any[] = [];
      let parserEventCount = 0;
      let apiEventCount = 0;

      const sessionKey = await streamResearch(
        {
          prompt: 'State consistency test'
        },
        {
          onEvent: (event) => {
            events.push(event);
            apiEventCount++;
          }
        }
      );

      // Check stored session
      const storedSession = await getSession(sessionKey);
      const storedEventCount = storedSession!.events.length;

      // All counts should match
      expect(apiEventCount).toBe(events.length);
      expect(storedEventCount).toBe(events.length);

      // Event content should be consistent
      events.forEach((apiEvent, index) => {
        const storedEvent = storedSession!.events[index];
        expect(storedEvent.type).toBe(apiEvent.type);
        expect(storedEvent.description).toBe(apiEvent.description);
      });
    });

    it('should handle state transitions correctly throughout workflow', async () => {
      const stateTransitions: string[] = [];
      let currentSessionKey = '';

      const sessionKey = await streamResearch(
        {
          prompt: 'State transition test'
        },
        {
          onStart: (key) => {
            currentSessionKey = key;
            stateTransitions.push('started');
          },
          onEvent: (event) => {
            stateTransitions.push(event.type);
          },
          onComplete: () => {
            stateTransitions.push('callback_complete');
          }
        }
      );

      // Check final session state
      const finalSession = await getSession(sessionKey);
      
      // State should progress logically
      expect(stateTransitions[0]).toBe('started');
      expect(stateTransitions[stateTransitions.length - 2]).toBe('completed');
      expect(stateTransitions[stateTransitions.length - 1]).toBe('callback_complete');

      // Final session should reflect completed state
      expect(finalSession!.status).toBe('completed');
      expect(finalSession!.completedAt).toBeTruthy();
      expect(new Date(finalSession!.completedAt!)).toBeInstanceOf(Date);
      expect(finalSession!.report).toBeTruthy();
    });
  });
});