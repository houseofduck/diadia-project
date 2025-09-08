"use client";

import { useMemo, useState, useEffect } from "react";
import { Badge } from "../components/ui/badge";
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
  Clock,
  ChevronDownIcon,
} from "lucide-react";
import { Message, MessageContent } from "../components/ai-elements/message";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "../components/ai-elements/conversation";
import { Task, TaskTrigger, TaskContent, TaskItem } from "../components/ai-elements/task";
import { cn } from "../lib/utils";
import type { SSEEvent } from "../services";

export interface EventFeedProps {
  events: SSEEvent[];
  className?: string;
  isStreaming?: boolean;
  userQuery?: string | null;
}

function getEventColor(type: string): string {
  // System events
  if (type === "started") {
    return "";
  }

  // Input/prompt events
  if (
    [
      "prompt_received",
      "prompt_analysis_started",
      "prompt_analysis_completed",
      "task_analysis_completed",
    ].includes(type)
  ) {
    return "";
  }

  // Research events
  if (
    [
      "topic_exploration_started",
      "topic_exploration_completed",
      "search_started",
      "search_result_processing_started",
      "aggregation_started",
      "research_completed",
      "research_complete",
    ].includes(type)
  ) {
    return "";
  }

  // Processing events
  if (["search_result_processing_completed"].includes(type)) {
    return "";
  }

  // Reporting events
  if (["reporting_started", "report_building", "report_processing"].includes(type)) {
    return "";
  }

  // Completion events
  if (["report_done"].includes(type)) {
    return "";
  }

  if (["completed"].includes(type)) {
    return "";
  }

  // Error states
  if (type === "error") {
    return "";
  }

  if (type === "cancelled") {
    return "";
  }

  // Default/generic
  return "";
}

// Convert snake_case to Title Case
function toTitleCase(str: string): string {
  return str.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function getFriendlyEventName(type: string): string {
  const friendlyNames: Record<string, string> = {
    started: "Research assistant ready",
    prompt_received: "Query received",
    prompt_analysis_started: "Starting prompt analysis",
    prompt_analysis_completed: "Prompt analysis complete",
    task_analysis_completed: "Task analysis complete",
    topic_exploration_started: "Exploring research topics",
    topic_exploration_completed: "Topic analysis complete",
    search_started: "Searching for Information",
    search_result_processing_started: "Processing search results",
    search_result_processing_completed: "Search result processed",
    aggregation_started: "Aggregating information",
    research_completed: "Research phase complete",
    research_complete: "Research phase complete",
    reporting_started: "Building report",
    report_building: "Building report",
    report_processing: "Formatting report",
    report_done: "Report complete",
    completed: "All tasks complete",
    error: "Error occurred",
    cancelled: "Task cancelled",
    generic: "Processing",
    progress: "In progress",
  };

  return friendlyNames[type] || toTitleCase(type);
}

function getEventIcon(type: string) {
  const iconMap: Record<string, typeof Play> = {
    started: Zap,
    prompt_received: Target,
    prompt_analysis_started: Brain,
    prompt_analysis_completed: CheckCircle,
    task_analysis_completed: CheckCircle,
    topic_exploration_started: BookOpen,
    topic_exploration_completed: CheckCircle,
    search_started: Search,
    search_result_processing_started: Database,
    search_result_processing_completed: CheckCircle,
    aggregation_started: Settings,
    research_completed: CheckCircle,
    research_complete: CheckCircle,
    reporting_started: FileText,
    report_building: FileText,
    report_processing: Loader,
    report_done: CheckCircle,
    completed: CheckCircle,
    error: AlertCircle,
    cancelled: AlertCircle,
    generic: Play,
    progress: Loader,
  };

  const IconComponent = iconMap[type] || Play;
  return IconComponent;
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

function LiveElapsedTime({
  startTime,
  eventTime,
  isLatest,
  isStreaming,
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

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Clock className="w-3 h-3" />
      <span>{elapsedTime}</span>
    </div>
  );
}

export function EventFeed({ events, className, isStreaming = false, userQuery }: EventFeedProps) {
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    [events]
  );

  const startTime = sortedEvents.length > 0 ? sortedEvents[0].timestamp : new Date();

  if (events.length === 0) {
    return (
      <div
        className={cn("flex-1 flex items-center justify-center text-muted-foreground", className)}
      >
        <div className="text-center">
          <div className="text-6xl mb-4">🤖</div>
          <p className="text-lg font-medium">Ready for research</p>
          <p className="text-sm">Ask a question to get started</p>
        </div>
      </div>
    );
  }

  return (
    <Conversation className={cn("h-full", className)}>
      <ConversationContent className="space-y-3">
        {/* User Query at the top */}
        {userQuery ? (
          <Message from="user" className="justify-start">
            <MessageContent className="bg-primary text-primary-foreground">
              {userQuery}
            </MessageContent>
          </Message>
        ) : null}

        {sortedEvents.map((event, index) => {
          const IconComponent = getEventIcon(event.type);
          const hasDetails = event.description || (event.data && typeof event.data === "object");

          return (
            <Message key={`${event.id}-${index}`} from="assistant" className="w-full">
              <MessageContent>
                <Task defaultOpen={false} className="w-full">
                  <TaskTrigger title={getFriendlyEventName(event.type)} className="w-full">
                    <div className="flex items-center justify-between w-full cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1 transition-colors">
                      <div className="flex items-center gap-3">
                        <IconComponent className="w-4 h-4 text-muted-foreground" />
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn("text-xs font-medium border-0", getEventColor(event.type))}
                          >
                            {getFriendlyEventName(event.type)}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <LiveElapsedTime
                          startTime={startTime}
                          eventTime={event.timestamp}
                          isLatest={index === sortedEvents.length - 1}
                          isStreaming={isStreaming}
                        />
                        {hasDetails ? (
                          <div className="ml-2 group-data-[state=open]:rotate-180 transition-transform">
                            <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </TaskTrigger>

                  {hasDetails ? (
                    <TaskContent>
                      {event.description ? (
                        <TaskItem>
                          <p className="text-sm leading-relaxed">{event.description}</p>
                        </TaskItem>
                      ) : null}
                      {event.data && typeof event.data === "object" ? (
                        <TaskItem>
                          <div className="p-3 bg-muted/50 rounded border text-xs">
                            <pre className="whitespace-pre-wrap break-all">
                              {JSON.stringify(event.data, null, 2)}
                            </pre>
                          </div>
                        </TaskItem>
                      ) : null}
                    </TaskContent>
                  ) : null}
                </Task>
              </MessageContent>
            </Message>
          );
        })}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
