"use client";

import { useState } from "react";
import { Loader2, Globe, Linkedin, Twitter, Mail, Copy, Check } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { WorkflowStatus } from "@/types";

interface ChannelPanelProps {
  contentRequestId: string;
  channelContent: any[];
  requestedChannels: string[];
  status: WorkflowStatus;
  isOwner: boolean;
  onAdapt: () => void;
}

const CHANNEL_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  linkedin: { icon: Linkedin, label: "LinkedIn", color: "text-blue-600" },
  x: { icon: Twitter, label: "X (Twitter)", color: "text-foreground" },
  newsletter: { icon: Mail, label: "Newsletter", color: "text-violet-600" },
  article: { icon: Globe, label: "Article", color: "text-muted-foreground" },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 h-6 px-2 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/**
 * Convert simple Markdown to clean plain text for copy/display.
 * We render a structured preview instead of raw markdown symbols.
 */
function renderMarkdownAsText(content: string): string {
  return content
    .replace(/^#{1,6}\s+/gm, "") // remove heading markers
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold → plain
    .replace(/\*(.*?)\*/g, "$1") // italic → plain
    .replace(/`(.*?)`/g, "$1") // inline code → plain
    .replace(/^\s*[-*+]\s+/gm, "• ") // bullet lists
    .replace(/^\s*\d+\.\s+/gm, "") // numbered lists
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links → text only
    .replace(/---+/g, "───") // horizontal rules
    .trim();
}

/** Render channel content as a structured preview (not raw markdown) */
function ChannelContentPreview({ content, channel: _channel }: { content: string; channel: string }) {
  // Split into paragraphs and render each line appropriately
  const lines = content.split(/\n/);

  return (
    <div className="space-y-1.5 text-[13px] text-foreground leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;

        // Heading
        const headingMatch = trimmed.match(/^#{1,6}\s+(.+)/);
        if (headingMatch) {
          return (
            <p key={i} className="font-semibold text-foreground">
              {headingMatch[1]}
            </p>
          );
        }

        // Bullet
        if (trimmed.match(/^[-*+]\s+/)) {
          return (
            <p key={i} className="flex gap-2">
              <span className="text-muted-foreground flex-shrink-0 mt-0.5">•</span>
              <span>{formatInline(trimmed.replace(/^[-*+]\s+/, ""))}</span>
            </p>
          );
        }

        // Horizontal rule
        if (trimmed.match(/^---+$/)) {
          return <hr key={i} className="border-border my-1" />;
        }

        // Arrow emoji lines (X-style)
        if (trimmed.startsWith("→")) {
          return (
            <p key={i} className="flex gap-2">
              <span className="text-primary flex-shrink-0">→</span>
              <span>{formatInline(trimmed.slice(1).trim())}</span>
            </p>
          );
        }

        return <p key={i}>{formatInline(trimmed)}</p>;
      })}
    </div>
  );
}

function formatInline(text: string): React.ReactNode {
  // Handle **bold** inline
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => {
        const boldMatch = part.match(/^\*\*(.+)\*\*$/);
        if (boldMatch) return <strong key={i} className="font-semibold">{boldMatch[1]}</strong>;
        return part;
      })}
    </>
  );
}

const VALIDATION_CONFIG = {
  valid: "text-green-700 dark:text-green-400 bg-[hsl(var(--success-subtle))] ring-[hsl(var(--success-border))]",
  invalid: "text-red-700 dark:text-red-400 bg-[hsl(var(--danger-subtle))] ring-[hsl(var(--danger-border))]",
  revision_needed: "text-amber-700 dark:text-amber-400 bg-[hsl(var(--warning-subtle))] ring-[hsl(var(--warning-border))]",
  pending: "text-muted-foreground bg-secondary ring-border",
};

export function ChannelPanel({
  contentRequestId: _cid,
  channelContent,
  requestedChannels: _rc,
  status,
  isOwner: _isOwner,
  onAdapt: _onAdapt,
}: ChannelPanelProps) {
  const isAdapting = status === "CHANNEL_ADAPTATION";

  if (isAdapting) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-primary mb-3" />
        <p className="text-[13px] font-medium text-foreground">Generating channel content…</p>
        <p className="text-[12px] text-muted-foreground mt-1">This takes 30–60 seconds</p>
      </div>
    );
  }

  if (!channelContent.length) {
    return (
      <EmptyState
        icon={Globe}
        title="No channel content yet"
        description="Content will appear here after approval and channel adaptation."
      />
    );
  }

  return (
    <div className="space-y-4">
      {channelContent.map((ch) => {
        const meta = CHANNEL_META[ch.channel] ?? CHANNEL_META.article;
        const Icon = meta.icon;
        const cleanText = renderMarkdownAsText(ch.content);

        return (
          <Card key={ch.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Icon size={14} className={meta.color} />
                <CardTitle>{meta.label}</CardTitle>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className={cn(
                  "text-[11px] px-1.5 py-0.5 rounded ring-1 font-medium",
                  VALIDATION_CONFIG[ch.validation_status as keyof typeof VALIDATION_CONFIG] ?? VALIDATION_CONFIG.pending
                )}>
                  {ch.validation_status === "valid" ? "✓ Valid" : ch.validation_status}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {ch.character_count} chars
                </span>
                <CopyButton text={cleanText} />
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Subject line for newsletter */}
              {ch.subject_line && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-[hsl(var(--info-subtle))] border border-[hsl(var(--info-border))]">
                  <span className="text-[11px] font-medium text-primary uppercase tracking-wide flex-shrink-0">Subject</span>
                  <span className="text-[13px] font-medium text-foreground">{ch.subject_line}</span>
                </div>
              )}

              {/* Rendered content preview */}
              <div className="rounded-md bg-secondary/40 border border-border p-4">
                <ChannelContentPreview content={ch.content} channel={ch.channel} />
              </div>

              {/* Hashtags */}
              {ch.hashtags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {ch.hashtags.map((tag: string) => (
                    <span key={tag} className="px-2 py-0.5 bg-[hsl(var(--info-subtle))] text-primary rounded text-[11px] font-medium ring-1 ring-[hsl(var(--info-border))]">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* CTA */}
              {ch.cta && (
                <p className="text-[12px] text-muted-foreground flex items-center gap-1">
                  <span className="font-medium">CTA:</span> {ch.cta}
                </p>
              )}

              {/* Validation errors */}
              {ch.validation_errors?.filter((e: any) => e.severity === "error").length > 0 && (
                <Alert variant="error" title="Validation issues">
                  <ul className="space-y-0.5">
                    {ch.validation_errors.filter((e: any) => e.severity === "error").map((err: any, i: number) => (
                      <li key={i} className="text-[12px]">• {err.message}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              {ch.validation_errors?.filter((e: any) => e.severity === "warning").length > 0 && (
                <Alert variant="warning">
                  <ul className="space-y-0.5">
                    {ch.validation_errors.filter((e: any) => e.severity === "warning").map((err: any, i: number) => (
                      <li key={i} className="text-[12px]">• {err.message}</li>
                    ))}
                  </ul>
                </Alert>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
