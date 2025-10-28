"use client";

import { Thermometer } from "lucide-react";
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
import { TemperatureSelector } from "@/components/temperature-selector";
import { cn } from "@/lib/utils";

/**
 * Temperature preset labels for tooltip display
 */
const TEMPERATURE_PRESETS = {
  precise: { value: 0.3, label: "Precise" },
  balanced: { value: 1.0, label: "Balanced" },
  creative: { value: 1.7, label: "Creative" },
} as const;

interface TemperaturePopoverProps {
  /**
   * Current temperature value (0-2)
   */
  value: number;

  /**
   * Callback when temperature changes
   */
  onChange: (value: number) => void;

  /**
   * Default temperature value for comparison (to show visual indicator)
   */
  defaultValue: number;

  /**
   * Whether the popover button is disabled
   */
  disabled?: boolean;
}

/**
 * Get the closest preset label for a temperature value
 */
function getPresetLabel(temperature: number): string {
  let closest = "Balanced";
  let minDiff = Infinity;

  for (const preset of Object.values(TEMPERATURE_PRESETS)) {
    const diff = Math.abs(preset.value - temperature);
    if (diff < minDiff) {
      minDiff = diff;
      closest = preset.label;
    }
  }

  // If it's a custom value (not close to any preset), show the exact value
  if (minDiff > 0.15) {
    return temperature.toFixed(1);
  }

  return closest;
}

/**
 * Temperature control popover for inline message composer integration
 *
 * Provides a compact button that opens a popover containing the full
 * TemperatureSelector component. Shows visual indicators when the
 * temperature differs from the default value.
 */
export function TemperaturePopover({
  value,
  onChange,
  defaultValue,
  disabled = false,
}: TemperaturePopoverProps) {
  const isNonDefault = Math.abs(value - defaultValue) > 0.01;
  const presetLabel = getPresetLabel(value);

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
                  isNonDefault &&
                    "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                )}
                aria-label={`Temperature: ${presetLabel}`}
              >
                <Thermometer className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>
              Temperature: <span className="font-medium">{presetLabel}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {isNonDefault ? "Custom value set" : "Using default"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium leading-none mb-1">Temperature</h4>
            <p className="text-sm text-muted-foreground">
              Control the randomness of AI responses
            </p>
          </div>
          <TemperatureSelector
            value={value}
            onChange={onChange}
            showLabel={false}
            showDescription={true}
          />
          {isNonDefault && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onChange(defaultValue)}
            >
              Reset to Default ({defaultValue.toFixed(1)})
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
