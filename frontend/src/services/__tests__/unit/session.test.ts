import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateSessionKey,
  parseSessionKey,
  isValidSessionKey,
  saveSession,
  getSession,
  getAllSessions,
  deleteSession,
  clearAllSessions,
  getRecentSessions,
} from '../../utils/session';
import type { ResearchSession } from '../../types/research.types';

// Mock window and localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Mock global window object
Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: localStorageMock,
  },
  writable: true,
});

describe('Session Management', () => {
  const mockSession: ResearchSession = {
    sessionKey: 'test-session-key',
    prompt: 'Test research prompt',
    startedAt: new Date('2024-01-15T10:30:00Z'),
    events: [],
    status: 'idle',
  };

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('generateSessionKey', () => {
    it('should generate unique session keys', () => {
      const key1 = generateSessionKey();
      const key2 = generateSessionKey();
      
      expect(key1).not.toBe(key2);
      expect(typeof key1).toBe('string');
      expect(typeof key2).toBe('string');
    });

    it('should include timestamp and random ID', () => {
      const key = generateSessionKey();
      const parts = key.split('-');
      
      // Format: YYYY-MM-DDTHH-MM-SS-fffZ-randomId (7 parts when split by -)
      expect(parts).toHaveLength(7); // ["2025", "09", "08T13", "05", "02", "012Z", "random"]
      expect(parts[0]).toMatch(/^\d{4}$/); // Year
      expect(parts[1]).toMatch(/^\d{2}$/); // Month
      expect(parts[2]).toMatch(/^\d{2}T\d{2}$/); // Day and hour
    });

    it('should generate keys with current timestamp', () => {
      const before = new Date();
      const key = generateSessionKey();
      const after = new Date();
      
      const parsed = parseSessionKey(key);
      expect(parsed).not.toBeNull();
      expect(parsed!.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(parsed!.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('parseSessionKey', () => {
    it('should parse valid session key', () => {
      const key = generateSessionKey();
      const parsed = parseSessionKey(key);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.timestamp).toBeInstanceOf(Date);
      expect(typeof parsed!.id).toBe('string');
      expect(parsed!.id.length).toBeGreaterThan(0);
    });

    it('should return null for invalid format', () => {
      expect(parseSessionKey('invalid')).toBeNull();
      expect(parseSessionKey('2024-01-15')).toBeNull();
      expect(parseSessionKey('')).toBeNull();
    });

    it('should return null for malformed timestamp', () => {
      expect(parseSessionKey('invalid-timestamp-format-abc123')).toBeNull();
    });

    it('should handle edge case formats', () => {
      expect(parseSessionKey('2024-13-32T25-61-61-999Z-abc123')).toBeNull(); // Invalid date
    });
  });

  describe('isValidSessionKey', () => {
    it('should validate correct session keys', () => {
      const key = generateSessionKey();
      expect(isValidSessionKey(key)).toBe(true);
    });

    it('should reject invalid session keys', () => {
      expect(isValidSessionKey('invalid')).toBe(false);
      expect(isValidSessionKey('')).toBe(false);
      expect(isValidSessionKey('2024-01-15')).toBe(false);
    });
  });

  describe('Session Storage Operations', () => {

    describe('saveSession', () => {
      it('should save session to localStorage', async () => {
        await saveSession('test-key', mockSession);
        
        const stored = JSON.parse(window.localStorage.getItem('research_sessions')!);
        expect(stored['test-key']).toEqual({
          ...mockSession,
          startedAt: mockSession.startedAt.toISOString(), // Date gets serialized to ISO string
          updatedAt: expect.any(String),
        });
      });

      it('should add updatedAt timestamp', async () => {
        const before = new Date().toISOString();
        await saveSession('test-key', mockSession);
        const after = new Date().toISOString();
        
        const stored = JSON.parse(window.localStorage.getItem('research_sessions')!);
        const updatedAt = stored['test-key'].updatedAt;
        
        expect(new Date(updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
        expect(new Date(updatedAt).getTime()).toBeLessThanOrEqual(new Date(after).getTime());
      });

      it('should handle localStorage errors gracefully', async () => {
        const originalSetItem = window.localStorage.setItem;
        window.localStorage.setItem = vi.fn(() => {
          throw new Error('Storage quota exceeded');
        });

        await expect(saveSession('test-key', mockSession)).rejects.toThrow();
        
        window.localStorage.setItem = originalSetItem;
      });
    });

    describe('getSession', () => {
      it('should retrieve existing session', async () => {
        await saveSession('test-key', mockSession);
        const retrieved = await getSession('test-key');
        
        expect(retrieved).toEqual({
          ...mockSession,
          updatedAt: expect.any(String),
        });
      });

      it('should return null for non-existent session', async () => {
        const result = await getSession('non-existent');
        expect(result).toBeNull();
      });

      it('should handle localStorage errors gracefully', async () => {
        const originalGetItem = window.localStorage.getItem;
        window.localStorage.getItem = vi.fn(() => {
          throw new Error('Storage error');
        });

        const result = await getSession('test-key');
        expect(result).toBeNull();
        
        window.localStorage.getItem = originalGetItem;
      });
    });

    describe('getAllSessions', () => {
      it('should return empty object when no sessions', async () => {
        const sessions = await getAllSessions();
        expect(sessions).toEqual({});
      });

      it('should return all stored sessions', async () => {
        await saveSession('key1', { ...mockSession, prompt: 'First' });
        await saveSession('key2', { ...mockSession, prompt: 'Second' });
        
        const sessions = await getAllSessions();
        
        expect(Object.keys(sessions)).toHaveLength(2);
        expect(sessions['key1'].prompt).toBe('First');
        expect(sessions['key2'].prompt).toBe('Second');
      });
    });

    describe('deleteSession', () => {
      it('should remove specific session', async () => {
        await saveSession('key1', mockSession);
        await saveSession('key2', mockSession);
        
        await deleteSession('key1');
        
        const sessions = await getAllSessions();
        expect(sessions['key1']).toBeUndefined();
        expect(sessions['key2']).toBeDefined();
      });

      it('should handle deleting non-existent session', async () => {
        await expect(deleteSession('non-existent')).resolves.toBeUndefined();
      });
    });

    describe('clearAllSessions', () => {
      it('should remove all sessions', async () => {
        await saveSession('key1', mockSession);
        await saveSession('key2', mockSession);
        
        await clearAllSessions();
        
        const sessions = await getAllSessions();
        expect(sessions).toEqual({});
        expect(window.localStorage.getItem('research_sessions')).toBeNull();
      });
    });

    describe('getRecentSessions', () => {
      it('should return sessions sorted by updatedAt', async () => {
        // Save sessions with different timestamps
        await saveSession('older', mockSession);
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        await saveSession('newer', { ...mockSession, prompt: 'Newer' });
        
        const recent = await getRecentSessions();
        
        expect(recent).toHaveLength(2);
        expect(recent[0].data.prompt).toBe('Newer'); // Most recent first
        expect(recent[1].sessionKey).toBe('older');
      });

      it('should limit results to specified count', async () => {
        for (let i = 0; i < 5; i++) {
          await saveSession(`key${i}`, { ...mockSession, prompt: `Session ${i}` });
        }
        
        const recent = await getRecentSessions(3);
        expect(recent).toHaveLength(3);
      });

      it('should default to 10 results', async () => {
        for (let i = 0; i < 15; i++) {
          await saveSession(`key${i}`, mockSession);
        }
        
        const recent = await getRecentSessions();
        expect(recent).toHaveLength(10);
      });

      it('should return empty array when no sessions', async () => {
        const recent = await getRecentSessions();
        expect(recent).toEqual([]);
      });
    });
  });

  describe('SSR Safety', () => {
    let originalWindow: any;

    beforeEach(() => {
      originalWindow = globalThis.window;
    });

    afterEach(() => {
      globalThis.window = originalWindow;
    });

    it('should handle undefined window gracefully', async () => {
      // @ts-ignore - Simulate SSR environment
      globalThis.window = undefined;

      await expect(saveSession('test', mockSession)).resolves.toBeUndefined();
      await expect(getSession('test')).resolves.toBeNull();
      await expect(getAllSessions()).resolves.toEqual({});
      await expect(deleteSession('test')).resolves.toBeUndefined();
      await expect(clearAllSessions()).resolves.toBeUndefined();
      await expect(getRecentSessions()).resolves.toEqual([]);
    });
  });
});