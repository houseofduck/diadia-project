export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  ENDPOINTS: {
    RESEARCH: '/api/research',
    RESEARCH_V2: '/api/research2',
    HEALTH: '/',
  },
  DEFAULT_TIMEOUT: 600000, // 10 minutes for long research tasks
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
  },
} as const;

export const RESEARCH_CONFIG = {
  MAX_TOPICS: 1,
  MAX_SEARCH_PHRASES: 1,
  DEFAULT_START_FROM: 'research' as const,
  MOCK_DIRECTORY: 'mock_instances/stocks_24th_3_sections',
} as const;

export const SSE_CONFIG = {
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // ms
  CHUNK_SIZE: 1024 * 64, // 64KB chunks
} as const;