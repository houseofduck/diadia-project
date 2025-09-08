'use client';

import { useState, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { 
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
  PromptInputTools,
  PromptInputButton,
} from '../components/ai-elements/prompt-input';
import { 
  Message,
  MessageContent,
} from '../components/ai-elements/message';
import { EventFeed } from '../components/EventFeed';
import { ReportView } from '../components/ReportView';
import { SessionBanner } from '../components/SessionBanner';
import { useResearchStream } from '../hooks/useResearchStream';
import { cn } from '../lib/utils';
import { X, AlertCircle, Wifi, WifiOff } from 'lucide-react';

// Error Banner Component
function ErrorBanner({ 
  error, 
  onRetry, 
  onReset 
}: { 
  error: string; 
  onRetry: () => void; 
  onReset: () => void; 
}) {
  return (
    <div className="bg-red-50 border-red-200 border p-4 mx-4 mb-4 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-red-800">Error occurred</h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="text-red-700 border-red-300 hover:bg-red-50"
          >
            Retry
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-red-700 hover:bg-red-50"
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}

// Offline Banner Component
function OfflineBanner({ isOnline }: { isOnline: boolean }) {
  if (isOnline) return null;

  return (
    <div className="bg-orange-50 border-orange-200 border p-3 mx-4 mb-4 rounded-lg">
      <div className="flex items-center gap-3">
        <WifiOff className="w-4 h-4 text-orange-600" />
        <span className="text-sm text-orange-700">
          You're offline. Please check your internet connection.
        </span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [prompt, setPrompt] = useState('');
  const [userMessage, setUserMessage] = useState<string | null>(null);
  
  const {
    sessionKey,
    status,
    events,
    error,
    report,
    isOnline,
    start,
    cancel,
    retry,
    reset,
  } = useResearchStream();

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim() || status === 'streaming' || status === 'submitting') {
      return;
    }

    setUserMessage(prompt.trim());
    await start(prompt.trim());
    setPrompt(''); // Clear input after submission
  }, [prompt, status, start]);

  const handleCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  const handleNewQuery = useCallback(() => {
    reset();
    setUserMessage(null);
  }, [reset]);

  const handleRetry = useCallback(() => {
    retry();
  }, [retry]);

  const handleReset = useCallback(() => {
    reset();
    setUserMessage(null);
  }, [reset]);

  const isInputDisabled = status === 'submitting' || status === 'streaming' || !isOnline;
  const showingReport = status === 'completed' && report;
  const showingProgress = (status === 'streaming' || status === 'submitting') && events.length > 0;
  const showingError = status === 'error' && error;

  return (
    <div className="h-full flex flex-col">
      {/* Session Banner */}
      <SessionBanner sessionKey={sessionKey} status={status} />
      
      {/* Offline Banner */}
      <OfflineBanner isOnline={isOnline} />
      
      {/* Error Banner */}
      {showingError && (
        <ErrorBanner
          error={error}
          onRetry={handleRetry}
          onReset={handleReset}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        
        {/* User Message Display (if submitted) */}
        {userMessage && (
          <div className="px-4 py-3 border-b">
            <Message from="user" className="justify-start">
              <MessageContent className="bg-primary text-primary-foreground">
                {userMessage}
              </MessageContent>
            </Message>
          </div>
        )}

        {/* Content Display */}
        {showingReport ? (
          <ReportView 
            report={report} 
            sessionKey={sessionKey || undefined}
            onNewQuery={handleNewQuery}
            className="flex-1 min-h-0"
          />
        ) : showingProgress ? (
          <div className="flex-1 min-h-0">
            <EventFeed events={events} className="h-full" />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md mx-auto p-8">
              <div className="text-6xl mb-6">🔍</div>
              <h1 className="text-2xl font-bold mb-4">
                Deep Research Assistant
              </h1>
              <p className="text-muted-foreground mb-6">
                Ask me anything and I'll conduct comprehensive research to give you detailed, well-sourced answers.
              </p>
              <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
                {isOnline ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-600" />
                    <span>Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-red-600" />
                    <span>Offline</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t bg-background">
          <PromptInput onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <PromptInputTextarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What would you like me to research? (e.g., 'Latest developments in quantum computing')"
              disabled={isInputDisabled}
              className="min-h-[60px]"
            />
            <PromptInputToolbar>
              <PromptInputTools>
                {(status === 'streaming' || status === 'submitting') && (
                  <PromptInputButton
                    variant="ghost"
                    onClick={handleCancel}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </PromptInputButton>
                )}
              </PromptInputTools>
              
              <PromptInputSubmit
                disabled={isInputDisabled || !prompt.trim()}
                status={status === 'submitting' ? 'submitted' : status === 'streaming' ? 'streaming' : undefined}
              />
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
