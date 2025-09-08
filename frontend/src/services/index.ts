// Research API functions
export {
  streamResearch,
  simpleResearch,
  dryRun,
  cancelResearch,
  cancelAllResearch,
  getActiveStreams,
  isStreamActive,
  retryResearch,
} from './api/research';

export {
  streamResearchV2,
  researchWithStrategy,
  researchWithCustomStrategy,
  cancelResearch as cancelResearchV2,
  getActiveStreams as getActiveStreamsV2,
  RESEARCH_STRATEGIES,
} from './api/research2';

// Configuration
export { API_CONFIG, RESEARCH_CONFIG, SSE_CONFIG } from './config';

// Types
export type {
  ResearchRequest,
  ResearchV2Request,
  ResearchResponse,
  ResearchSession,
  SessionStatus,
  SSEEvent,
  EventType,
  ProgressEvent,
  CompletedEvent,
  ErrorEvent,
  ResearchMetadata,
  StartFrom,
} from './types/research.types';

export type {
  BaseEvent,
  ParsedSSEEvent,
  StreamController,
  StreamOptions,
} from './types/events.types';

// Utilities
export {
  generateSessionKey,
  parseSessionKey,
  isValidSessionKey,
  saveSession,
  getSession,
  getAllSessions,
  deleteSession,
  clearAllSessions,
  getRecentSessions,
} from './utils/session';

export type {
  StoredSession,
  SessionRecord,
} from './utils/session';

export {
  createSSEParser,
  parseSSEStream,
  createStreamController,
} from './utils/sse-parser';

// Error classes
export { SSEParseError } from './types/events.types';