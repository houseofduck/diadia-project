'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Response } from '../components/ai-elements/response';
import { 
  InlineCitation,
  InlineCitationText,
  InlineCitationCard,
  InlineCitationCardTrigger,
  InlineCitationCardBody,
  InlineCitationSource,
} from '../components/ai-elements/inline-citation';
import { cn } from '../lib/utils';
import { 
  Copy, 
  Download, 
  Share2, 
  CheckIcon,
  ExternalLinkIcon 
} from 'lucide-react';

export interface ReportViewProps {
  report: string;
  sessionKey?: string;
  className?: string;
  onNewQuery?: () => void;
}

// Custom renderer for markdown with inline citations
function MarkdownWithCitations({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const linkData = useMemo(() => {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const links: { text: string; url: string }[] = [];
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      links.push({ text: match[1], url: match[2] });
    }
    
    // Group links by domain for citation clustering
    const sourcesByDomain: { [domain: string]: string[] } = {};
    links.forEach(link => {
      try {
        const domain = new URL(link.url).hostname;
        if (!sourcesByDomain[domain]) {
          sourcesByDomain[domain] = [];
        }
        if (!sourcesByDomain[domain].includes(link.url)) {
          sourcesByDomain[domain].push(link.url);
        }
      } catch {
        if (!sourcesByDomain['unknown']) {
          sourcesByDomain['unknown'] = [];
        }
        if (!sourcesByDomain['unknown'].includes(link.url)) {
          sourcesByDomain['unknown'].push(link.url);
        }
      }
    });
    
    return sourcesByDomain;
  }, [content]);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Find all rendered links and enhance them with citation styling
    const links = containerRef.current.querySelectorAll('a[href]');
    
    links.forEach((link) => {
      const href = link.getAttribute('href');
      const text = link.textContent;
      
      if (!href || !text) return;
      
      try {
        const domain = new URL(href).hostname;
        const sources = linkData[domain] || [href];
        
        // Add citation styling
        link.className = 'text-blue-600 hover:text-blue-800 border-b border-blue-200 hover:border-blue-400 no-underline hover:no-underline transition-colors';
        link.setAttribute('data-domain', domain);
        link.setAttribute('data-sources', sources.join(','));
        link.setAttribute('title', `Source: ${domain} (${sources.length} link${sources.length > 1 ? 's' : ''})`);
        
      } catch {
        // Keep as regular link for invalid URLs
      }
    });
  }, [content, linkData]);
  
  return (
    <div 
      ref={containerRef}
      className="prose prose-sm dark:prose-invert max-w-none"
    >
      <Response>{content}</Response>
    </div>
  );
}

export function ReportView({ 
  report, 
  sessionKey, 
  className, 
  onNewQuery 
}: ReportViewProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleCopyReport = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  }, [report]);

  const handleDownloadMarkdown = useCallback(() => {
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-report-${sessionKey || Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [report, sessionKey]);

  const handleShareLink = useCallback(async () => {
    if (!sessionKey) return;
    
    const shareUrl = `${window.location.origin}/sessions/${sessionKey}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2000);
    } catch (err) {
      setShareStatus('error');
      setTimeout(() => setShareStatus('idle'), 2000);
    }
  }, [sessionKey]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/50">
        <div className="flex items-center gap-3">
          <div className="text-lg">📊</div>
          <div>
            <h2 className="font-semibold text-lg">Research Report</h2>
            {sessionKey && (
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs font-mono">
                  {sessionKey.slice(0, 8)}...
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date().toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyReport}
            disabled={copyStatus === 'copied'}
          >
            {copyStatus === 'copied' ? (
              <CheckIcon className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadMarkdown}
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
          
          {sessionKey && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShareLink}
              disabled={shareStatus === 'copied'}
            >
              {shareStatus === 'copied' ? (
                <CheckIcon className="w-4 h-4" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
              {shareStatus === 'copied' ? 'Link Copied!' : 'Share'}
            </Button>
          )}
        </div>
      </div>

      {/* Report content */}
      <ScrollArea className="flex-1 p-6">
        <MarkdownWithCitations content={report} />
      </ScrollArea>

      {/* Footer actions */}
      <div className="p-4 border-t bg-background/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Report generated successfully</span>
            {sessionKey && (
              <Button
                variant="link"
                size="sm"
                onClick={() => window.open(`/sessions/${sessionKey}`, '_blank')}
                className="h-auto p-0 text-xs"
              >
                <ExternalLinkIcon className="w-3 h-3 mr-1" />
                Open in new tab
              </Button>
            )}
          </div>
          
          {onNewQuery && (
            <Button onClick={onNewQuery}>
              New Research Query
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}