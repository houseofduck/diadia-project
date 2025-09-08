export type BaseEvent = {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
};

export type ParsedSSEEvent = {
  type: string;
  description?: string;
  data?: unknown;
  session_key?: string;
  error?: string;
  report?: string;
  [key: string]: unknown;
};

export class SSEParseError extends Error {
  constructor(
    message: string,
    public readonly chunk?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SSEParseError';
  }
}

export type StreamController = {
  abort: () => void;
  signal: AbortSignal;
  isAborted: boolean;
};

export type StreamOptions = {
  onEvent?: (event: ParsedSSEEvent) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
  onStart?: (sessionKey: string) => void;
  signal?: AbortSignal;
  retryAttempts?: number;
  retryDelay?: number;
};