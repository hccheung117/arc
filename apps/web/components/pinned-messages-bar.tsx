"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Pin, ArrowLeft } from "lucide-react";
import type { Message } from "@arc/core/core.js";

interface PinnedMessagesBarProps {
  pinnedMessages: Message[];
  onPinClick: (messageId: string) => void;
  onReturnToPosition?: () => void;
}

export function PinnedMessagesBar({
  pinnedMessages,
  onPinClick,
  onReturnToPosition,
}: PinnedMessagesBarProps) {
  if (pinnedMessages.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border bg-muted/30 px-4 py-2">
      <div className="flex items-center gap-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Pin className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            Pinned:
          </span>
        </div>

        <ScrollArea className="flex-1">
          <div className="flex gap-2">
            {pinnedMessages.map((message, index) => {
              const truncatedContent =
                message.content.length > 50
                  ? message.content.slice(0, 50) + "..."
                  : message.content;

              return (
                <Button
                  key={message.id}
                  variant="secondary"
                  size="sm"
                  className="flex-shrink-0 max-w-xs"
                  onClick={() => onPinClick(message.id)}
                >
                  <span className="font-semibold mr-2">Pin {index + 1}:</span>
                  <span className="truncate">{truncatedContent}</span>
                </Button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {onReturnToPosition && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-shrink-0"
            onClick={onReturnToPosition}
          >
            <ArrowLeft className="size-4 mr-2" />
            Return
          </Button>
        )}
      </div>
    </div>
  );
}
