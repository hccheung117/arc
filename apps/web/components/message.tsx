"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ImageBubble } from "@/components/image-bubble";
import { ModelBadge } from "@/components/model-badge";
import {
  StopCircle,
  RotateCcw,
  Trash2,
  AlertCircle,
  Copy,
  Edit3,
  GitBranch,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { keyboardShortcuts } from "@/lib/keyboard-shortcuts";
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
  onEdit?: (messageId: string, content: string) => void;
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
  onEdit,
  onRetry,
  errorMetadata
}: MessageProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleEdit = () => {
    if (!isUser) return;
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const trimmed = editContent.trim();
    if (trimmed && trimmed !== message.content && onEdit) {
      onEdit(message.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  const handleBranchOff = () => {
    toast.info("Coming Soon", {
      description: "Branch Off feature is not yet available",
    });
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
          {isEditing ? (
            // Edit mode for user messages
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="w-full min-h-[80px] p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <span className="text-xs text-muted-foreground self-center ml-2">
                  {keyboardShortcuts.sendMessage.label} to save, Esc to cancel
                </span>
              </div>
            </div>
          ) : isUser ? (
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

        {/* Context Menu - always available */}
        {!isStreaming && !isEditing && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Message options"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Message options (Right-click)</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopy}>
                <Copy className="mr-2 size-4" />
                Copy
                <DropdownMenuShortcut>{keyboardShortcuts.copyMessage.label}</DropdownMenuShortcut>
              </DropdownMenuItem>

              {isUser && onEdit && (
                <DropdownMenuItem onClick={handleEdit}>
                  <Edit3 className="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
              )}

              {!isUser && isLatestAssistant && onRegenerate && (
                <DropdownMenuItem onClick={handleRegenerate}>
                  <RotateCcw className="mr-2 size-4" />
                  Regenerate
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={handleDelete} variant="destructive">
                <Trash2 className="mr-2 size-4" />
                Delete
                <DropdownMenuShortcut>{keyboardShortcuts.deleteMessage.label}</DropdownMenuShortcut>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem disabled onClick={handleBranchOff}>
                <GitBranch className="mr-2 size-4" />
                Branch Off
                <DropdownMenuShortcut>Soon</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Action buttons - show on hover or always show for error retry */}
        {(isHovered || showRetryButton) && (showStopButton || showRegenerateButton || showDeleteButton || showRetryButton) && (
          <div className="absolute -bottom-8 left-0 flex gap-1 mt-1">
            {showStopButton && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleStop}
                    className="h-7 px-2 text-xs"
                  >
                    <StopCircle className="size-3 mr-1" />
                    Stop
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Stop generation (Esc)</p>
                </TooltipContent>
              </Tooltip>
            )}

            {showRegenerateButton && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRegenerate}
                    className="h-7 px-2 text-xs"
                  >
                    <RotateCcw className="size-3 mr-1" />
                    Regenerate
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Regenerate response</p>
                </TooltipContent>
              </Tooltip>
            )}

            {showDeleteButton && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDelete}
                    className="h-7 px-2 text-xs"
                  >
                    <Trash2 className="size-3 mr-1" />
                    Delete
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete message ({keyboardShortcuts.deleteMessage.label})</p>
                </TooltipContent>
              </Tooltip>
            )}

            {showRetryButton && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetry}
                    className="h-7 px-2 text-xs border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <RotateCcw className="size-3 mr-1" />
                    Retry
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Retry failed operation</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
