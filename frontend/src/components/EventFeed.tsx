'use client';

import { useMemo, useState, useEffect } from 'react';
import { Badge } from '../components/ui/badge';
import { 
  Search, 
  Brain, 
  CheckCircle, 
  AlertCircle, 
  Zap, 
  FileText, 
  Play, 
  Loader, 
  Database, 
  BookOpen, 
  Target, 
  Globe, 
  Settings, 
  Clock 
} from 'lucide-react';
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
  isStreaming?: boolean;
}

function getEventColor(type: string): string {
  // System events
  if (type === 'started') {
    return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
  }
  
  // Input/prompt events
  if (['prompt_received', 'prompt_analysis_started', 'prompt_analysis_completed', 'task_analysis_completed'].includes(type)) {
    return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
  }
  
  // Research events
  if (['topic_exploration_started', 'topic_exploration_completed', 'search_started', 'search_result_processing_started', 'aggregation_started', 'research_completed', 'research_complete'].includes(type)) {
    return 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20';
  }
  
  // Processing events
  if (['search_result_processing_completed'].includes(type)) {
    return 'bg-sky-500/10 text-sky-700 border-sky-500/20';
  }
  
  // Reporting events
  if (['reporting_started', 'report_building', 'report_processing'].includes(type)) {
    return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
  }
  
  // Completion events
  if (['report_done'].includes(type)) {
    return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
  }
  
  if (['completed'].includes(type)) {
    return 'bg-green-500/10 text-green-700 border-green-500/20';
  }
  
  // Error states
  if (type === 'error') {
    return 'bg-red-500/10 text-red-700 border-red-500/20';
  }
  
  if (type === 'cancelled') {
    return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
  }
  
  // Default/generic
  return 'bg-slate-500/10 text-slate-700 border-slate-500/20';
}

// Convert snake_case to Title Case
function toTitleCase(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function getFriendlyEventName(type: string): string {
  const friendlyNames: Record<string, string> = {
    'started': 'Research Assistant Ready',
    'prompt_received': 'Query Received',
    'prompt_analysis_started': 'Starting Prompt Analysis',
    'prompt_analysis_completed': 'Prompt Analysis Complete',
    'task_analysis_completed': 'Task Analysis Complete',
    'topic_exploration_started': 'Exploring Research Topics',
    'topic_exploration_completed': 'Topic Analysis Complete',
    'search_started': 'Searching for Information',
    'search_result_processing_started': 'Processing Search Results',
    'search_result_processing_completed': 'Search Result Processed',
    'aggregation_started': 'Aggregating Information',
    'research_completed': 'Research Phase Complete',
    'research_complete': 'Research Phase Complete',
    'reporting_started': 'Building Report',
    'report_building': 'Building Report',
    'report_processing': 'Formatting Report',
    'report_done': 'Report Complete',
    'completed': 'All Tasks Complete',
    'error': 'Error Occurred',
    'cancelled': 'Task Cancelled',
    'generic': 'Processing',
    'progress': 'In Progress',
  };
  
  return friendlyNames[type] || toTitleCase(type);
}

function getEventIcon(type: string) {
  const iconMap: Record<string, typeof Play> = {
    'started': Zap,
    'prompt_received': Target,
    'prompt_analysis_started': Brain,
    'prompt_analysis_completed': CheckCircle,
    'task_analysis_completed': CheckCircle,
    'topic_exploration_started': BookOpen,
    'topic_exploration_completed': CheckCircle,
    'search_started': Search,
    'search_result_processing_started': Database,
    'search_result_processing_completed': CheckCircle,
    'aggregation_started': Settings,
    'research_completed': CheckCircle,
    'research_complete': CheckCircle,
    'reporting_started': FileText,
    'report_building': FileText,
    'report_processing': Loader,
    'report_done': CheckCircle,
    'completed': CheckCircle,
    'error': AlertCircle,
    'cancelled': AlertCircle,
    'generic': Play,
    'progress': Loader,
  };
  
  const IconComponent = iconMap[type] || Play;
  return IconComponent;
}

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function getElapsedTime(startTime: Date, currentTime: Date): string {
  const diffInSeconds = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds}s`;
  }
  
  const minutes = Math.floor(diffInSeconds / 60);
  const seconds = diffInSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function LiveTimestamp({ 
  startTime, 
  eventTime, 
  isLatest, 
  isStreaming 
}: { 
  startTime: Date; 
  eventTime: Date; 
  isLatest: boolean;
  isStreaming: boolean;
}) {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    if (!isLatest || !isStreaming) {
      return;
    }
    
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isLatest, isStreaming]);
  
  const displayTime = isLatest && isStreaming ? currentTime : eventTime;
  const elapsedTime = getElapsedTime(startTime, displayTime);
  const timestamp = formatTimestamp(displayTime);
  
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Clock className="w-3 h-3" />
      <span>{elapsedTime}</span>
      <span className="text-muted-foreground/50">•</span>
      <span>{timestamp}</span>
    </div>
  );
}

export function EventFeed({ events, className, isStreaming = false }: EventFeedProps) {
  const sortedEvents = useMemo(() => 
    [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    [events]
  );
  
  const startTime = sortedEvents.length > 0 ? sortedEvents[0].timestamp : new Date();

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
    <Conversation className={cn('h-full', className)}>
      <ConversationContent className="space-y-3">
        {sortedEvents.map((event, index) => (
          <Message
            key={`${event.id}-${index}`}
            from="assistant"
            className="w-full"
          >
            <MessageContent>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {(() => {
                    const IconComponent = getEventIcon(event.type);
                    return <IconComponent className="w-4 h-4 text-muted-foreground" />;
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={cn('text-xs font-medium border', getEventColor(event.type))}
                      >
                        {getFriendlyEventName(event.type)}
                      </Badge>
                    </div>
                    <LiveTimestamp
                      startTime={startTime}
                      eventTime={event.timestamp}
                      isLatest={index === sortedEvents.length - 1}
                      isStreaming={isStreaming}
                    />
                  </div>
                  {event.description && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
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
  );
}