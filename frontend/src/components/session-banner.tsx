"use client";

import { useState, useCallback } from "react";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import {
  Copy,
  CheckIcon,
  Clock,
  Rocket,
  Zap,
  CheckCircle,
  XCircle,
  Ban,
  WifiOff,
  HelpCircle,
} from "lucide-react";
import type { SessionStatus } from "../services";

export interface SessionBannerProps {
  sessionKey: string | null;
  status: SessionStatus;
  className?: string;
}

function getStatusColor(status: SessionStatus): string {
  switch (status) {
    case "streaming":
      return "text-[#20201a] animate-pulse";
    case "completed":
      return "text-[#20201a]";
    default:
      return "text-[#20201a]/70";
  }
}

function getStatusIcon(status: SessionStatus) {
  switch (status) {
    case "idle":
      return Clock;
    case "submitting":
      return Rocket;
    case "streaming":
      return Zap;
    case "completed":
      return CheckCircle;
    case "error":
      return XCircle;
    case "cancelled":
      return Ban;
    case "offline":
      return WifiOff;
    default:
      return HelpCircle;
  }
}

function getStatusText(status: SessionStatus): string {
  switch (status) {
    case "idle":
      return "Ready";
    case "submitting":
      return "Submitting...";
    case "streaming":
      return "Researching...";
    case "completed":
      return "Completed";
    case "error":
      return "Error";
    case "cancelled":
      return "Cancelled";
    case "offline":
      return "Offline";
    default:
      return "Unknown";
  }
}

export function SessionBanner({ sessionKey, status, className }: SessionBannerProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const handleCopySessionKey = useCallback(async () => {
    if (!sessionKey) return;

    try {
      const url = `${window.location.origin}/sessions/${sessionKey}`;
      await navigator.clipboard.writeText(url);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (err) {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2000);
    }
  }, [sessionKey]);

  if (!sessionKey) {
    return null;
  }

  const StatusIcon = getStatusIcon(status);

  return (
    <div className={cn("flex items-center justify-between p-3 ", className)}>
      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <div className={cn("flex items-center gap-1 font-bold text-sm", getStatusColor(status))}>
          <StatusIcon className="w-4 h-4" />
          {getStatusText(status)}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopySessionKey}
          disabled={copyStatus === "copied"}
          className="h-7 px-2 text-xs font-bold"
        >
          {copyStatus === "copied" ? (
            <>
              <CheckIcon className="w-3 h-3 mr-1" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 mr-1" />
              Copy Link
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
