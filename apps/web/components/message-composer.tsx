import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SendIcon, ImageIcon, X, AlertCircle } from "lucide-react";
import { ImageAttachmentChip } from "@/components/image-attachment-chip";
import { TemperaturePopover } from "@/components/temperature-popover";
import { SystemPromptPopover } from "@/components/system-prompt-popover";
import { keyboardShortcuts } from "@/lib/keyboard-shortcuts";
import type { ImageAttachment } from "@arc/core/core.js";

interface MessageComposerProps {
  messageInput: string;
  setMessageInput: (value: string) => void;
  attachedImages: ImageAttachment[];
  attachmentError: string;
  clearAttachmentError: () => void;
  removeImageAttachment: (index: number) => void;
  hasProvider: boolean;
  isStreaming: boolean;
  temperature: number;
  defaultTemperature: number;
  onTemperatureChange: (value: number) => void;
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
  onSendMessage: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function MessageComposer({
  messageInput,
  setMessageInput,
  attachedImages,
  attachmentError,
  clearAttachmentError,
  removeImageAttachment,
  hasProvider,
  isStreaming,
  temperature,
  defaultTemperature,
  onTemperatureChange,
  systemPrompt,
  onSystemPromptChange,
  onSendMessage,
  onDrop,
  onDragOver,
  onPaste,
  fileInputRef,
  onFileInputChange,
}: MessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const lineHeight = 20;
    const maxHeight = lineHeight * 10;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [messageInput]);

  return (
    <div
      className="border-t p-4 bg-background"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <div className="space-y-3 px-2 md:px-4">
        {attachmentError && (
          <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
            <AlertCircle className="size-4 text-destructive flex-shrink-0" />
            <p className="text-destructive flex-1">{attachmentError}</p>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearAttachmentError}
              className="size-5 p-0 hover:bg-destructive/20"
              aria-label="Dismiss error"
            >
              <X className="size-3" />
            </Button>
          </div>
        )}

        {attachedImages.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {attachedImages.map((attachment, index) => (
              <ImageAttachmentChip
                key={index}
                attachment={attachment}
                onRemove={() => removeImageAttachment(index)}
              />
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          multiple
          onChange={onFileInputChange}
          className="hidden"
          aria-hidden="true"
        />

        <div className="border rounded-lg bg-background focus-within:ring-2 focus-within:ring-ring transition-shadow">
          <div className="px-4 pt-3 pb-2">
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder={
                !hasProvider
                  ? "Configure a provider in settings first..."
                  : isStreaming
                    ? "Waiting for response..."
                    : "Ask anything"
              }
              className="w-full bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-y-auto"
              aria-label="Message input"
              tabIndex={0}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={onPaste}
              disabled={!hasProvider || isStreaming}
            />
          </div>

          <div className="px-3 pb-2 flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 hover:bg-accent"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!hasProvider || isStreaming}
                  aria-label="Attach image"
                >
                  <ImageIcon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{keyboardShortcuts.attachImage.description} ({keyboardShortcuts.attachImage.label})</p>
              </TooltipContent>
            </Tooltip>

            <TemperaturePopover
              value={temperature}
              onChange={onTemperatureChange}
              defaultValue={defaultTemperature}
              disabled={!hasProvider || isStreaming}
            />

            <SystemPromptPopover
              value={systemPrompt}
              onChange={onSystemPromptChange}
              disabled={!hasProvider || isStreaming}
            />

            <div className="flex-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 hover:bg-accent disabled:opacity-30"
                  aria-label="Send message"
                  onClick={onSendMessage}
                  disabled={
                    !hasProvider ||
                    isStreaming ||
                    (!messageInput.trim() && attachedImages.length === 0)
                  }
                >
                  <SendIcon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{keyboardShortcuts.sendMessage.description} ({keyboardShortcuts.sendMessage.label})</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
