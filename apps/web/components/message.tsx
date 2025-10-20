"use client";

import { useState } from "react";
import type { Message as MessageType } from "@/lib/types";
import { useChatStore } from "@/lib/chat-store";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ImageBubble } from "@/components/image-bubble";
import { StopCircle, RotateCcw, Trash2 } from "lucide-react";

interface MessageProps {
  message: MessageType;
  isLatestAssistant: boolean;
}

export function Message({ message, isLatestAssistant }: MessageProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { stopStreaming, regenerateMessage, deleteMessage } = useChatStore();

  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  const isStopped = message.status === "stopped";

  const handleStop = () => {
    stopStreaming();
  };

  const handleRegenerate = () => {
    regenerateMessage(message.id);
  };

  const handleDelete = () => {
    deleteMessage(message.id);
  };

  // Determine which actions to show
  const showStopButton = isStreaming;
  const showRegenerateButton = isLatestAssistant && !isStreaming;
  const showDeleteButton = !isStreaming;

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
            : "bg-secondary text-secondary-foreground"
        }`}
      >
        {/* Image attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-3">
            <ImageBubble attachments={message.attachments} />
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
              <MarkdownRenderer content={message.content} />
              {isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />}
              {isStopped && <span className="text-xs opacity-70 ml-2">(stopped)</span>}
            </>
          )}
        </div>

        {/* Action buttons - show on hover */}
        {isHovered && (showStopButton || showRegenerateButton || showDeleteButton) && (
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
          </div>
        )}
      </div>
    </div>
  );
}
