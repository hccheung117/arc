"use client";

import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface SystemPromptPopoverProps {
  /**
   * Current system prompt override value
   */
  value: string;

  /**
   * Callback when system prompt changes
   */
  onChange: (value: string) => void;

  /**
   * Whether the popover button is disabled
   */
  disabled?: boolean;
}

/**
 * System prompt override popover for inline message composer integration
 *
 * Provides a compact button that opens a popover containing a textarea
 * for custom system prompt input. Shows visual indicator when a custom
 * system prompt is set.
 */
export function SystemPromptPopover({
  value,
  onChange,
  disabled = false,
}: SystemPromptPopoverProps) {
  const hasCustomPrompt = value.trim().length > 0;

  const handleClear = () => {
    onChange("");
  };

  return (
    <Popover>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={disabled}
                className={cn(
                  "h-9 w-9 flex-shrink-0",
                  hasCustomPrompt &&
                    "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                )}
                aria-label={
                  hasCustomPrompt
                    ? "System prompt override active"
                    : "No system prompt override"
                }
              >
                <FileText className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>System Prompt Override</p>
            <p className="text-xs text-muted-foreground">
              {hasCustomPrompt ? "Custom prompt active" : "No override set"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium leading-none mb-1">
                System Prompt Override
              </h4>
              <p className="text-sm text-muted-foreground">
                Customize the AI&apos;s behavior for this chat
              </p>
            </div>
            {hasCustomPrompt && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -mt-1"
                onClick={handleClear}
                aria-label="Clear system prompt"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter a custom system prompt to override the default behavior..."
            className="min-h-[120px] resize-none"
            disabled={disabled}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {value.trim().length > 0
                ? `${value.trim().length} characters`
                : "No custom prompt"}
            </span>
            {hasCustomPrompt && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="h-7"
              >
                Clear
              </Button>
            )}
          </div>
          {!hasCustomPrompt && (
            <p className="text-xs text-muted-foreground">
              Leave empty to use the default system prompt from settings
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
