'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { SessionStatus } from '../services';

export interface SessionContextValue {
  sessionKey: string | null;
  status: SessionStatus;
  setSessionKey: (key: string | null) => void;
  setStatus: (status: SessionStatus) => void;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus>('idle');

  const clearSession = useCallback(() => {
    setSessionKey(null);
    setStatus('idle');
  }, []);

  const value: SessionContextValue = {
    sessionKey,
    status,
    setSessionKey,
    setStatus,
    clearSession,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}