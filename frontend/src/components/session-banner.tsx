'use client';

import { useState, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import { 
  Copy, 
  CheckIcon,
  ExternalLinkIcon,
  Eye,
  EyeOff
} from 'lucide-react';
import type { SessionStatus } from '../services';

export interface SessionBannerProps {
  sessionKey: string | null;
  status: SessionStatus;
  className?: string;
}

function getStatusColor(status: SessionStatus): string {
  switch (status) {
    case 'idle':
      return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    case 'submitting':
      return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
    case 'streaming':
      return 'bg-green-500/10 text-green-700 border-green-500/20 animate-pulse';
    case 'completed':
      return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
    case 'error':
      return 'bg-red-500/10 text-red-700 border-red-500/20';
    case 'cancelled':
      return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
    case 'offline':
      return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    default:
      return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
  }
}

function getStatusIcon(status: SessionStatus): string {
  switch (status) {
    case 'idle':
      return '⏳';
    case 'submitting':
      return '🚀';
    case 'streaming':
      return '⚡';
    case 'completed':
      return '✅';
    case 'error':
      return '❌';
    case 'cancelled':
      return '⛔';
    case 'offline':
      return '📡';
    default:
      return '🤖';
  }
}

function getStatusText(status: SessionStatus): string {
  switch (status) {
    case 'idle':
      return 'Ready';
    case 'submitting':
      return 'Submitting...';
    case 'streaming':
      return 'Researching...';
    case 'completed':
      return 'Completed';
    case 'error':
      return 'Error';
    case 'cancelled':
      return 'Cancelled';
    case 'offline':
      return 'Offline';
    default:
      return 'Unknown';
  }
}

export function SessionBanner({ sessionKey, status, className }: SessionBannerProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [showFullKey, setShowFullKey] = useState(false);

  const handleCopySessionKey = useCallback(async () => {
    if (!sessionKey) return;
    
    try {
      await navigator.clipboard.writeText(sessionKey);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  }, [sessionKey]);

  const handleOpenSession = useCallback(() => {
    if (!sessionKey) return;
    window.open(`/sessions/${sessionKey}`, '_blank');
  }, [sessionKey]);

  if (!sessionKey) {
    return null;
  }

  const displayKey = showFullKey ? sessionKey : `${sessionKey.slice(0, 8)}...${sessionKey.slice(-4)}`;

  return (
    <div className={cn(
      'flex items-center justify-between p-3 bg-muted/50 border-b',
      className
    )}>
      <div className="flex items-center gap-3">
        <Badge 
          variant="outline" 
          className={cn('border', getStatusColor(status))}
        >
          <span className="mr-1">{getStatusIcon(status)}</span>
          {getStatusText(status)}
        </Badge>
        
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Session:</span>
          <code className="font-mono text-xs bg-background px-2 py-1 rounded border">
            {displayKey}
          </code>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFullKey(!showFullKey)}
            className="h-6 w-6 p-0"
            title={showFullKey ? 'Hide full key' : 'Show full key'}
          >
            {showFullKey ? (
              <EyeOff className="w-3 h-3" />
            ) : (
              <Eye className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopySessionKey}
          disabled={copyStatus === 'copied'}
          className="h-7 px-2 text-xs"
        >
          {copyStatus === 'copied' ? (
            <>
              <CheckIcon className="w-3 h-3 mr-1" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 mr-1" />
              Copy
            </>
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpenSession}
          className="h-7 px-2 text-xs"
          title="Open session in new tab"
        >
          <ExternalLinkIcon className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}