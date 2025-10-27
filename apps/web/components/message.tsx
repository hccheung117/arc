"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ImageBubble } from "@/components/image-bubble";
import { ModelBadge } from "@/components/model-badge";
import { StopCircle, RotateCcw, Trash2, AlertCircle } from "lucide-react";
import type { ProviderConfig } from "@arc/core/core.js";

interface MessageType {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: "pending" | "streaming" | "complete" | "stopped" | "error";
  attachments?: Array<{ data: string; mimeType: string; id: string; size: number; name?: string }>;
  model?: string;
  providerConnectionId?: string;
}

interface MessageProps {
  message: MessageType;
  isLatestAssistant: boolean;
  isHighlighted?: boolean;
  providers?: ProviderConfig[];
  onStop?: () => void;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onRetry?: () => void;
  errorMetadata?: {
    isRetryable: boolean;
  };
}

export function Message({
  message,
  isLatestAssistant,
  isHighlighted = false,
  providers = [],
  onStop,
  onRegenerate,
  onDelete,
  onRetry,
  errorMetadata
}: MessageProps) {
  const [isHovered, setIsHovered] = useState(false);

  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  const isStopped = message.status === "stopped";
  const isError = message.status === "error";

  const handleStop = () => {
    if (onStop) {
      onStop();
    }
  };

  const handleRegenerate = () => {
    if (onRegenerate) {
      onRegenerate(message.id);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(message.id);
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
  };

  // Determine which actions to show
  const showStopButton = isStreaming;
  const showRegenerateButton = isLatestAssistant && !isStreaming && !isError;
  const showDeleteButton = !isStreaming && !isError;
  const showRetryButton = isError && errorMetadata?.isRetryable && onRetry;

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`group relative max-w-[80%] rounded-lg p-4 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : isError
            ? "bg-destructive/10 text-destructive border-2 border-destructive/50"
            : "bg-secondary text-secondary-foreground"
        } ${isHighlighted ? "ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-950/30" : ""}`}
      >
        {/* Image attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-3">
            <ImageBubble attachments={message.attachments} />
          </div>
        )}

        {/* Model badge for assistant messages */}
        {!isUser && (message.model || message.providerConnectionId) && (
          <div className="mb-2">
            <ModelBadge
              model={message.model}
              providerConnectionId={message.providerConnectionId}
              providers={providers}
            />
          </div>
        )}

        {/* Message content */}
        <div className="text-sm break-words">
          {isUser ? (
            // User messages: plain text with whitespace preserved
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            // Assistant messages: render as markdown
            <>
              {isError && (
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="size-5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <MarkdownRenderer content={message.content} />
                  </div>
                </div>
              )}
              {!isError && (
                <>
                  <MarkdownRenderer content={message.content} />
                  {isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />}
                  {isStopped && <span className="text-xs opacity-70 ml-2">(stopped)</span>}
                </>
              )}
            </>
          )}
        </div>

        {/* Action buttons - show on hover or always show for error retry */}
        {(isHovered || showRetryButton) && (showStopButton || showRegenerateButton || showDeleteButton || showRetryButton) && (
          <div className="absolute -bottom-8 left-0 flex gap-1 mt-1">
            {showStopButton && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleStop}
                className="h-7 px-2 text-xs"
              >
                <StopCircle className="size-3 mr-1" />
                Stop
              </Button>
            )}

            {showRegenerateButton && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRegenerate}
                className="h-7 px-2 text-xs"
              >
                <RotateCcw className="size-3 mr-1" />
                Regenerate
              </Button>
            )}

            {showDeleteButton && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDelete}
                className="h-7 px-2 text-xs"
              >
                <Trash2 className="size-3 mr-1" />
                Delete
              </Button>
            )}

            {showRetryButton && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                className="h-7 px-2 text-xs border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <RotateCcw className="size-3 mr-1" />
                Retry
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
