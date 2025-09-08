export type StartFrom = 'research' | 'reporting';

export type ResearchRequest = {
  dry?: boolean;
  session_key?: string;
  start_from?: StartFrom;
  prompt: string;
  mock_directory?: string;
};

export type ResearchV2Request = {
  prompt: string;
  strategy_id?: string;
  strategy_content?: string;
};

export type ResearchResponse = {
  session_key: string;
  status: 'success' | 'error';
  message?: string;
};

export type ResearchSession = {
  sessionKey: string;
  prompt: string;
  startedAt: Date;
  completedAt?: Date;
  report?: string;
  error?: string;
  events: SSEEvent[];
  status: SessionStatus;
};

export type SessionStatus = 
  | 'idle'
  | 'submitting'
  | 'streaming'
  | 'completed'
  | 'error'
  | 'cancelled'
  | 'offline';

export type SSEEvent = {
  id?: string;
  type: EventType;
  description?: string;
  data?: unknown;
  timestamp: Date;
  raw?: string;
};

export type EventType = 
  | 'started'
  | 'generic'
  | 'progress'
  | 'research_complete'
  | 'reporting_started'
  | 'completed'
  | 'error'
  | 'cancelled';

export type ProgressEvent = SSEEvent & {
  type: 'progress';
  data: {
    current: number;
    total: number;
    message?: string;
  };
};

export type CompletedEvent = SSEEvent & {
  type: 'completed';
  data: {
    report: string;
    session_key: string;
    metadata?: {
      duration_ms?: number;
      tokens_used?: number;
      sources_found?: number;
    };
  };
};

export type ErrorEvent = SSEEvent & {
  type: 'error';
  data: {
    message: string;
    code?: string;
    details?: unknown;
  };
};

export type ResearchMetadata = {
  topics?: string[];
  search_phrases?: string[];
  sources?: {
    url: string;
    title: string;
    relevance?: number;
  }[];
  model_used?: string;
};