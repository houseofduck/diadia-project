"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "../../../components/ui/button";

import { EventFeed } from "../../../components/EventFeed";
import { ReportView } from "../../../components/ReportView";
import { SessionBanner } from "../../../components/SessionBanner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { useResearchStream } from "../../../hooks/useResearchStream";
import { useSession } from "../../../context/SessionContext";
import { getSession, isValidSessionKey, saveSession } from "../../../services";
import { X, AlertCircle, Wifi, WifiOff, ArrowLeft } from "lucide-react";

// Error Banner Component
function ErrorBanner({
  error,
  onRetry,
  onReset,
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

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionKey = params?.sessionKey as string;
  const query = searchParams?.get("q");

  const [showReportModal, setShowReportModal] = useState(false);
  const [userMessage, setUserMessage] = useState<string | null>(query);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionNotFound, setSessionNotFound] = useState(false);
  const hasInitialized = useRef(false);

  const { setSessionKey } = useSession();
  const {
    sessionKey: currentSessionKey,
    status,
    events,
    error,
    report,
    isOnline,
    start,
    cancel,
    retry,
    reset,
    restoreSession,
  } = useResearchStream();

  // Handle session restoration and validation
  useEffect(() => {
    const handleSessionRestore = async () => {
      console.log("Handling session restore:", { sessionKey, query, status });

      if (!sessionKey) {
        router.push("/");
        return;
      }

      // Check if session key format is valid
      if (!isValidSessionKey(sessionKey)) {
        console.log("Invalid session key format");
        setSessionNotFound(true);
        setIsLoading(false);
        return;
      }

      try {
        // Try to get stored session data
        const storedSession = await getSession(sessionKey);
        console.log("Stored session found:", !!storedSession, storedSession?.status);

        if (storedSession) {
          // Session exists, restore its state
          setUserMessage(storedSession.prompt);
          console.log("Restoring session state");
          restoreSession(storedSession);

          if (storedSession.status === "streaming" || storedSession.status === "submitting") {
            // Session was interrupted, restart the research
            console.log("Resuming interrupted session");
            setTimeout(() => {
              start(storedSession.prompt, { session_key: sessionKey });
            }, 100);
          }
        } else if (query) {
          // No stored session but we have a query - start new research
          console.log("Starting new research with query:", query);
          setUserMessage(query);
          console.log("About to call start immediately with:", { query, sessionKey });
          start(query, { session_key: sessionKey });
        } else {
          // No stored session and no query - invalid session
          console.log("No stored session and no query");
          setSessionNotFound(true);
        }
      } catch (err) {
        console.error("Error restoring session:", err);
        setSessionNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    // Only run once when the component mounts
    if (isLoading && !hasInitialized.current) {
      hasInitialized.current = true;
      handleSessionRestore();
    }
  }, []); // Intentionally empty to run only once on mount

  const handleCancel = useCallback(() => {
    cancel();
    router.push("/");
  }, [cancel, router]);

  const handleNewQuery = useCallback(() => {
    router.push("/");
  }, [router]);

  const handleRetry = useCallback(() => {
    retry();
  }, [retry]);

  const handleReset = useCallback(() => {
    reset();
    router.push("/");
  }, [reset, router]);

  const hasReport = status === "completed" && report;
  const showingProgress =
    (status === "streaming" || status === "submitting" || hasReport) && events.length > 0;
  const showingError = status === "error" && error;

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-6xl mb-6">🔍</div>
          <h1 className="text-2xl font-bold mb-4">Loading Session...</h1>
          <p className="text-muted-foreground">Checking session status...</p>
        </div>
      </div>
    );
  }

  // Show session not found state
  if (sessionNotFound) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-6xl mb-6">❌</div>
          <h1 className="text-2xl font-bold mb-4">Session Not Found</h1>
          <p className="text-muted-foreground mb-6">
            This research session doesn't exist or has expired.
          </p>
          <Button onClick={() => router.push("/")} className="w-full">
            Start New Research
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with back button */}
      <div className="flex items-center gap-4 p-4 border-b bg-background/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          New Research
        </Button>
        <div className="flex-1">
          <SessionBanner sessionKey={sessionKey} status={status} />
        </div>
      </div>

      {/* Offline Banner */}
      <OfflineBanner isOnline={isOnline} />

      {/* Error Banner */}
      {showingError && <ErrorBanner error={error} onRetry={handleRetry} onReset={handleReset} />}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Content Display */}
        {showingProgress ? (
          <div className="flex-1 min-h-0 flex flex-col">
            <EventFeed
              events={events}
              className="flex-1"
              isStreaming={status === "streaming"}
              userQuery={userMessage}
            />

            {/* View Report Button - shown at bottom when report is ready */}
            {hasReport && (
              <div className="p-4 border-t bg-background/50">
                <div className="max-w-4xl mx-auto flex justify-center">
                  <Button
                    onClick={() => setShowReportModal(true)}
                    className="bg-green-600 hover:bg-green-700 text-white shadow-lg px-6 py-3"
                    size="lg"
                  >
                    📊 View Research Report
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md mx-auto p-8">
              <div className="text-6xl mb-6">🔍</div>
              <h1 className="text-2xl font-bold mb-4">Starting Research...</h1>
              <p className="text-muted-foreground mb-6">Initializing your research session.</p>
            </div>
          </div>
        )}

        {/* Cancel Button for active research */}
        {(status === "streaming" || status === "submitting") && (
          <div className="p-4 border-t bg-background">
            <div className="max-w-4xl mx-auto flex justify-center">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel Research
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Report Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="w-full h-full max-w-none md:max-w-3xl md:h-[95vh] md:w-auto md:right-4 md:left-auto md:translate-x-0 p-0 gap-0 md:top-4 md:translate-y-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">📊 Research Report</DialogTitle>
            <DialogDescription>Your comprehensive research results</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-6 pb-6">
            {report && (
              <ReportView
                report={report}
                sessionKey={sessionKey || undefined}
                onNewQuery={handleNewQuery}
                className="h-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
