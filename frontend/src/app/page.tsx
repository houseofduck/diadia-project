"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
  PromptInputTools,
} from "../components/ai-elements/prompt-input";
import { generateSessionKey } from "../services";
import { Wifi, WifiOff } from "lucide-react";

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const router = useRouter();

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== "undefined") {
      // Set initial online status
      setIsOnline(navigator.onLine);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!prompt.trim()) {
        return;
      }

      // Generate session key and navigate to session page with query
      const sessionKey = generateSessionKey();
      const query = encodeURIComponent(prompt.trim());

      router.push(`/sessions/${sessionKey}?q=${query}`);
    },
    [prompt, router]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-lg mx-auto p-8">
          <div className="text-6xl mb-6">🔍</div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-4 font-serif">
            Deep Research Assistant
          </h1>
          <p className="text-muted-foreground mb-8 text-lg">
            Ask me anything and I'll conduct comprehensive research to give you detailed,
            well-sourced answers.
          </p>
          <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground mb-8">
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

      {/* Input Area */}
      <div className="p-6 border-t bg-background/50">
        <PromptInput onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <PromptInputTextarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What would you like me to research? (e.g., 'Latest developments in quantum computing')"
            disabled={!isOnline}
            className="min-h-[80px] text-base"
          />
          <PromptInputToolbar>
            <PromptInputTools />
            <PromptInputSubmit disabled={!isOnline || !prompt.trim()} />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
}
