"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Response } from "../components/ai-elements/response";
import {
  InlineCitation,
  InlineCitationText,
  InlineCitationCard,
  InlineCitationCardTrigger,
  InlineCitationCardBody,
  InlineCitationSource,
} from "../components/ai-elements/inline-citation";
import { cn } from "../lib/utils";
import { Download, ExternalLinkIcon, Expand, X } from "lucide-react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export interface ReportViewProps {
  report: string;
  sessionKey?: string;
  className?: string;
  onNewQuery?: () => void;
  isFullWidth?: boolean;
  onToggleFullWidth?: () => void;
}

// Custom citation badge component
function CitationBadge({ refNum, url, domain }: { refNum: string; url: string; domain: string }) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <span
      onClick={handleClick}
      className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded cursor-pointer hover:bg-gray-200 transition-colors ml-1 border border-gray-200"
      title={`Source: ${domain}\nClick to open: ${url}`}
    >
      {domain}
    </span>
  );
}

// Custom renderer for markdown with inline citations
function MarkdownWithCitations({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { processedContent, referenceMap } = useMemo(() => {
    // Extract reference-style links at the bottom: [0]: https://...
    const referenceRegex = /\[(\d+)\]:\s*(https?:\/\/[^\s]+)/g;
    const references: { [key: string]: string } = {};
    let match;

    while ((match = referenceRegex.exec(content)) !== null) {
      references[match[1]] = match[2];
    }

    return { processedContent: content, referenceMap: references };
  }, [content]);

  // Post-process the rendered content to add citations
  useEffect(() => {
    if (!containerRef.current) return;

    // Find all [[number]] patterns in text nodes and replace them with citation badges
    const walker = document.createTreeWalker(containerRef.current, NodeFilter.SHOW_TEXT, null);

    const textNodes: Text[] = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }

    textNodes.forEach((textNode) => {
      const text = textNode.textContent || "";
      const citationRegex = /\[\[(\d+)\]\]/g;
      let hasMatch = false;
      let match;

      // Check if this text node contains citations
      while ((match = citationRegex.exec(text)) !== null) {
        hasMatch = true;
        break;
      }

      if (hasMatch) {
        // Create a new element to replace the text node
        const wrapper = document.createElement("span");
        let lastIndex = 0;

        // Reset regex
        citationRegex.lastIndex = 0;

        while ((match = citationRegex.exec(text)) !== null) {
          const [fullMatch, num] = match;
          const url = referenceMap[num];

          // Add text before citation
          if (match.index > lastIndex) {
            wrapper.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
          }

          // Add citation badge
          if (url) {
            try {
              const domain = new URL(url).hostname;
              const badge = document.createElement("span");
              badge.textContent = domain;
              badge.className =
                "px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded cursor-pointer hover:bg-gray-200 transition-colors ml-1 border border-gray-200";
              badge.title = `Source: ${domain}\nClick to open: ${url}`;
              badge.onclick = (e) => {
                e.preventDefault();
                window.open(url, "_blank", "noopener,noreferrer");
              };
              wrapper.appendChild(badge);
            } catch {
              wrapper.appendChild(document.createTextNode(fullMatch));
            }
          } else {
            wrapper.appendChild(document.createTextNode(fullMatch));
          }

          lastIndex = match.index + fullMatch.length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
          wrapper.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        // Replace the text node with the wrapper
        textNode.parentNode?.replaceChild(wrapper, textNode);
      }
    });

    // Also handle regular markdown links
    const links = containerRef.current.querySelectorAll("a[href]");
    links.forEach((link) => {
      const href = link.getAttribute("href");
      const text = link.textContent;

      if (!href || !text) return;

      try {
        const domain = new URL(href).hostname;

        // Create citation wrapper
        const citationWrapper = document.createElement("span");
        citationWrapper.className = "inline-flex items-center";

        // Create citation text
        const citationText = document.createElement("span");
        citationText.textContent = text;

        // Create citation badge
        const citationBadge = document.createElement("span");
        citationBadge.textContent = domain;
        citationBadge.className =
          "px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded cursor-pointer hover:bg-gray-200 transition-colors ml-1 border border-gray-200";
        citationBadge.title = `Source: ${domain}`;

        // Add click handler to open the source
        citationBadge.onclick = (e) => {
          e.preventDefault();
          window.open(href, "_blank", "noopener,noreferrer");
        };

        // Build the citation
        citationWrapper.appendChild(citationText);
        citationWrapper.appendChild(citationBadge);

        // Replace the original link
        link.parentNode?.replaceChild(citationWrapper, link);
      } catch {
        // Keep as regular link for invalid URLs but style it
        link.className = "text-blue-600 hover:text-blue-800 underline";
      }
    });
  }, [processedContent, referenceMap]);

  return (
    <div ref={containerRef} className="prose prose-lg dark:prose-invert max-w-none prose-h1:font-serif prose-p:mb-4 prose-h2:mt-8 prose-h2:mb-4 prose-h3:mt-6 prose-h3:mb-3">
      <Response>{processedContent}</Response>
    </div>
  );
}

export function ReportView({
  report,
  sessionKey,
  className,
  onNewQuery,
  isFullWidth = false,
  onToggleFullWidth,
}: ReportViewProps) {
  const handleDownloadPDF = useCallback(async () => {
    const reportContent = document.querySelector('[data-report-content]');
    if (!reportContent) return;

    try {
      // Create a temporary container for PDF generation with logo
      const pdfContainer = document.createElement('div');
      pdfContainer.style.position = 'absolute';
      pdfContainer.style.left = '-9999px';
      pdfContainer.style.top = '0';
      pdfContainer.style.width = '800px';
      pdfContainer.style.padding = '40px';
      pdfContainer.style.backgroundColor = 'white';
      pdfContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      
      // Add logo and title
      pdfContainer.innerHTML = `
        <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #e5e5e5; padding-bottom: 20px;">
          <div style="font-size: 24px; font-weight: bold; color: #1a1a1a; margin-bottom: 8px;">📊 Research Report</div>
          <div style="font-size: 14px; color: #666; font-family: monospace;">${sessionKey ? `Session: ${sessionKey.slice(0, 8)}...` : ''}</div>
          <div style="font-size: 12px; color: #999;">${new Date().toLocaleString()}</div>
        </div>
        <div style="line-height: 1.6; color: #333;"></div>
      `;
      
      // Clone and clean the report content
      const contentClone = reportContent.cloneNode(true) as HTMLElement;
      
      // Remove any interactive elements or unwanted styling
      const interactiveElements = contentClone.querySelectorAll('button, [role="button"], .hover\\:, [class*="hover:"]');
      interactiveElements.forEach(el => el.remove());
      
      // Ensure good PDF styling
      contentClone.style.maxWidth = 'none';
      contentClone.style.fontSize = '14px';
      contentClone.style.lineHeight = '1.6';
      contentClone.style.color = '#333';
      
      // Style headings for PDF
      const headings = contentClone.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach((heading, index) => {
        const h = heading as HTMLElement;
        h.style.color = '#1a1a1a';
        h.style.marginTop = index === 0 ? '0' : '24px';
        h.style.marginBottom = '12px';
        h.style.fontWeight = 'bold';
        if (h.tagName === 'H1') h.style.fontSize = '24px';
        if (h.tagName === 'H2') h.style.fontSize = '20px';
        if (h.tagName === 'H3') h.style.fontSize = '18px';
      });
      
      // Style paragraphs
      const paragraphs = contentClone.querySelectorAll('p');
      paragraphs.forEach(p => {
        const para = p as HTMLElement;
        para.style.marginBottom = '12px';
        para.style.textAlign = 'justify';
      });
      
      // Style lists
      const lists = contentClone.querySelectorAll('ul, ol');
      lists.forEach(list => {
        const l = list as HTMLElement;
        l.style.marginBottom = '12px';
        l.style.paddingLeft = '20px';
      });
      
      // Add the cleaned content to PDF container
      const contentDiv = pdfContainer.querySelector('div:last-child');
      if (contentDiv) {
        contentDiv.appendChild(contentClone);
      }
      
      document.body.appendChild(pdfContainer);
      
      // Generate PDF
      const canvas = await html2canvas(pdfContainer, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Download the PDF
      pdf.save(`research-report-${sessionKey || Date.now()}.pdf`);
      
      // Clean up
      document.body.removeChild(pdfContainer);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Fallback to markdown download
      const blob = new Blob([report], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `research-report-${sessionKey || Date.now()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [report, sessionKey]);

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-lg">📊</div>
          <h2 className="font-semibold text-lg">Research Report</h2>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {onToggleFullWidth && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleFullWidth}
              title={isFullWidth ? "Exit full width" : "Expand to full width"}
            >
              {isFullWidth ? <X className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Report content - with overflow handling */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-6" data-report-content>
          <MarkdownWithCitations content={report} />
        </div>
      </ScrollArea>

      {/* Footer - removed since buttons are now in main page */}
    </div>
  );
}
