"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, Settings2 } from "lucide-react";

interface AdvancedComposerControlsProps {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  onTemperatureChange: (value: number) => void;
  onMaxTokensChange: (value: number) => void;
  onSystemPromptChange: (value: string) => void;
}

export function AdvancedComposerControls({
  temperature,
  maxTokens,
  systemPrompt,
  onTemperatureChange,
  onMaxTokensChange,
  onSystemPromptChange,
}: AdvancedComposerControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-b border-border bg-muted/30">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        {/* Toggle button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full justify-between py-2 h-auto hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="size-4" />
            <span className="text-sm font-medium">Advanced Settings</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </Button>

        {/* Controls panel */}
        {isExpanded && (
          <div className="py-4 space-y-4">
            {/* Temperature */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label id="temperature-label" className="text-sm font-medium">
                  Temperature
                </Label>
                <span className="text-sm text-muted-foreground">
                  {temperature.toFixed(1)}
                </span>
              </div>
              <Slider
                id="temperature"
                aria-labelledby="temperature-label"
                min={0}
                max={2}
                step={0.1}
                value={[temperature]}
                onValueChange={(values) => onTemperatureChange(values[0] || 0)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Controls randomness. Lower is more focused, higher is more creative.
              </p>
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label id="maxTokens-label" className="text-sm font-medium">
                  Max Tokens
                </Label>
                <span className="text-sm text-muted-foreground">
                  {maxTokens}
                </span>
              </div>
              <Slider
                id="maxTokens"
                aria-labelledby="maxTokens-label"
                min={256}
                max={4096}
                step={256}
                value={[maxTokens]}
                onValueChange={(values) => onMaxTokensChange(values[0] || 256)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Maximum length of the response.
              </p>
            </div>

            {/* System Prompt Override */}
            <div className="space-y-2">
              <Label htmlFor="systemPrompt" className="text-sm font-medium">
                System Prompt Override
              </Label>
              <Textarea
                id="systemPrompt"
                value={systemPrompt}
                onChange={(e) => onSystemPromptChange(e.target.value)}
                placeholder="Enter a custom system prompt for this conversation..."
                className="min-h-[80px] text-sm resize-y"
              />
              <p className="text-xs text-muted-foreground">
                Override the default system prompt for this message.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
