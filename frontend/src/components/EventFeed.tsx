'use client';

import { useMemo } from 'react';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { 
  Message,
  MessageContent,
} from '../components/ai-elements/message';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton
} from '../components/ai-elements/conversation';
import { cn } from '../lib/utils';
import type { SSEEvent } from '../services';

export interface EventFeedProps {
  events: SSEEvent[];
  className?: string;
}

function getEventColor(type: string): string {
  switch (type) {
    case 'started':
      return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
    case 'generic':
    case 'progress':
      return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    case 'research_complete':
    case 'reporting_started':
      return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
    case 'completed':
      return 'bg-green-500/10 text-green-700 border-green-500/20';
    case 'error':
      return 'bg-red-500/10 text-red-700 border-red-500/20';
    case 'cancelled':
      return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
    default:
      return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
  }
}

function getEventIcon(type: string): string {
  switch (type) {
    case 'started':
      return '🚀';
    case 'generic':
      return '📝';
    case 'progress':
      return '⏳';
    case 'research_complete':
      return '🔍';
    case 'reporting_started':
      return '📊';
    case 'completed':
      return '✅';
    case 'error':
      return '❌';
    case 'cancelled':
      return '⛔';
    default:
      return '📄';
  }
}

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function EventFeed({ events, className }: EventFeedProps) {
  const sortedEvents = useMemo(() => 
    [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    [events]
  );

  if (events.length === 0) {
    return (
      <div className={cn(
        'flex-1 flex items-center justify-center text-muted-foreground',
        className
      )}>
        <div className="text-center">
          <div className="text-6xl mb-4">🤖</div>
          <p className="text-lg font-medium">Ready for research</p>
          <p className="text-sm">Ask a question to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex-1 min-h-0', className)}>
      <Conversation className="h-full">
        <ConversationContent className="space-y-3">
          {sortedEvents.map((event, index) => (
            <Message
              key={`${event.id}-${index}`}
              from="assistant"
              className="group w-full items-start"
            >
              <MessageContent className="w-full max-w-none">
                <div className="flex items-start gap-3">
                  <div className="text-lg leading-none mt-0.5">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge 
                        variant="outline" 
                        className={cn('text-xs font-medium border', getEventColor(event.type))}
                      >
                        {event.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-sm leading-relaxed">
                        {event.description}
                      </p>
                    )}
                    {event.data && typeof event.data === 'object' ? (
                      <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                        <pre className="whitespace-pre-wrap break-all">
                          {JSON.stringify(event.data, null, 2)}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                </div>
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  );
}