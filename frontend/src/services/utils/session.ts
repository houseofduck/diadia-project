import { ResearchSession } from "../types/research.types";

export function generateSessionKey(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const randomId = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomId}`;
}

export function parseSessionKey(sessionKey: string): {
  timestamp: Date;
  id: string;
} | null {
  try {
    const parts = sessionKey.split("-");
    if (parts.length < 7) {
      return null;
    }

    // Reconstruct the ISO timestamp from parts
    // Format: ["2025", "09", "08T13", "06", "13", "662Z", "abc123"]
    const year = parts[0];     // '2025'
    const month = parts[1];    // '09'
    const dayHour = parts[2];  // '08T13'
    const minute = parts[3];   // '06'
    const second = parts[4];   // '13'
    const msZ = parts[5];      // '662Z'
    
    // Split dayHour into day and hour
    const [day, hour] = dayHour.split('T');
    const ms = msZ.replace('Z', '');
    
    const timestampStr = `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}Z`;

    const timestamp = new Date(timestampStr);
    const id = parts[parts.length - 1];

    if (isNaN(timestamp.getTime())) {
      return null;
    }

    return { timestamp, id };
  } catch {
    return null;
  }
}

export function isValidSessionKey(sessionKey: string): boolean {
  return parseSessionKey(sessionKey) !== null;
}

const STORAGE_KEY = "research_sessions";

export type StoredSession = ResearchSession & {
  updatedAt: string;
};

export type SessionRecord = Record<string, StoredSession>;

export async function saveSession(sessionKey: string, data: ResearchSession): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const sessions = await getAllSessions();
    const storedSession: StoredSession = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    sessions[sessionKey] = storedSession;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error("Failed to save session:", error);
    throw error;
  }
}

export async function getSession(sessionKey: string): Promise<StoredSession | null> {
  if (typeof window === "undefined") return null;

  try {
    const sessions = await getAllSessions();
    const session = sessions[sessionKey];
    if (!session) return null;

    // Parse date strings back to Date objects
    return {
      ...session,
      startedAt: new Date(session.startedAt),
      updatedAt: session.updatedAt, // Keep as string for consistency
      completedAt: session.completedAt ? new Date(session.completedAt) : undefined,
      events: session.events.map(event => ({
        ...event,
        timestamp: new Date(event.timestamp)
      }))
    };
  } catch (error) {
    console.error("Failed to get session:", error);
    return null;
  }
}

// Type guard to check if an object looks like a stored session
function isStoredSessionLike(obj: unknown): obj is Record<string, unknown> & {
  sessionKey: string;
  prompt: string;
  status: string;
  startedAt: string;
  updatedAt: string;
  events: unknown[];
} {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'sessionKey' in obj &&
    'prompt' in obj &&
    'status' in obj &&
    'startedAt' in obj &&
    'updatedAt' in obj &&
    'events' in obj &&
    Array.isArray((obj as Record<string, unknown>).events)
  );
}

// Type guard for event-like objects
function isEventLike(obj: unknown): obj is Record<string, unknown> & {
  timestamp: string;
} {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'timestamp' in obj
  );
}

export async function getAllSessions(): Promise<SessionRecord> {
  if (typeof window === "undefined") return {};

  try {
    const data = window.localStorage.getItem(STORAGE_KEY);
    const sessions: Record<string, unknown> = data ? JSON.parse(data) : {};
    
    // Parse date strings back to Date objects for all sessions
    const parsedSessions: SessionRecord = {};
    for (const [key, session] of Object.entries(sessions)) {
      if (!isStoredSessionLike(session)) {
        console.warn(`Skipping invalid session data for key: ${key}`);
        continue;
      }

      parsedSessions[key] = {
        ...session,
        startedAt: new Date(session.startedAt),
        updatedAt: session.updatedAt, // Keep as string for consistency
        completedAt: session.completedAt ? new Date(session.completedAt as string) : undefined,
        events: session.events
          .filter(isEventLike)
          .map((event) => ({
            ...event,
            timestamp: new Date(event.timestamp)
          }))
      } as StoredSession;
    }
    
    return parsedSessions;
  } catch (error) {
    console.error("Failed to get all sessions:", error);
    return {};
  }
}

export async function deleteSession(sessionKey: string): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const sessions = await getAllSessions();
    delete sessions[sessionKey];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error("Failed to delete session:", error);
    throw error;
  }
}

export async function clearAllSessions(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear sessions:", error);
    throw error;
  }
}

export async function getRecentSessions(
  limit = 10
): Promise<Array<{ sessionKey: string; data: StoredSession }>> {
  const sessions = await getAllSessions();

  return Object.entries(sessions)
    .map(([sessionKey, data]) => ({ sessionKey, data }))
    .sort((a, b) => {
      const dateA = new Date(a.data.updatedAt).getTime();
      const dateB = new Date(b.data.updatedAt).getTime();
      return dateB - dateA;
    })
    .slice(0, limit);
}
