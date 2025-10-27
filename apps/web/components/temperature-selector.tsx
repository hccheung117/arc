"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

/**
 * Temperature preset levels with their corresponding values
 */
const TEMPERATURE_PRESETS = {
  precise: { value: 0.3, label: "Precise", description: "0.3" },
  balanced: { value: 1.0, label: "Balanced", description: "1.0" },
  creative: { value: 1.7, label: "Creative", description: "1.7" },
} as const;

type TemperaturePreset = keyof typeof TEMPERATURE_PRESETS;

interface TemperatureSelectorProps {
  /**
   * Current temperature value (0-2)
   */
  value: number;

  /**
   * Callback when temperature changes
   */
  onChange: (value: number) => void;

  /**
   * Optional ID for accessibility
   */
  id?: string;

  /**
   * Whether to show the label
   */
  showLabel?: boolean;

  /**
   * Whether to show the description text
   */
  showDescription?: boolean;
}

/**
 * Temperature selector component with 3-level presets and optional advanced slider
 *
 * Provides a user-friendly interface for selecting AI temperature with:
 * - Simple mode: 3 preset levels (Precise, Balanced, Creative)
 * - Advanced mode: Fine-grained slider control (0-2 range)
 */
export function TemperatureSelector({
  value,
  onChange,
  id = "temperature",
  showLabel = true,
  showDescription = true,
}: TemperatureSelectorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Determine which preset is closest to the current value
  const getCurrentPreset = (): TemperaturePreset => {
    const presets = Object.entries(TEMPERATURE_PRESETS);
    let closest: TemperaturePreset = "balanced";
    let minDiff = Infinity;

    for (const [key, preset] of presets) {
      const diff = Math.abs(preset.value - value);
      if (diff < minDiff) {
        minDiff = diff;
        closest = key as TemperaturePreset;
      }
    }

    return closest;
  };

  const currentPreset = getCurrentPreset();

  const handlePresetChange = (preset: string) => {
    const presetData = TEMPERATURE_PRESETS[preset as TemperaturePreset];
    if (presetData) {
      onChange(presetData.value);
    }
  };

  return (
    <div className="space-y-3">
      {showLabel && (
        <div className="flex items-center justify-between">
          <Label htmlFor={id}>Temperature</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="h-auto py-1 px-2 text-xs"
          >
            {showAdvanced ? "Simple" : "Advanced"}
          </Button>
        </div>
      )}

      {!showAdvanced ? (
        <>
          <RadioGroup
            id={id}
            value={currentPreset}
            onValueChange={handlePresetChange}
            className="grid grid-cols-3 gap-4"
          >
            {Object.entries(TEMPERATURE_PRESETS).map(([key, preset]) => (
              <div key={key}>
                <RadioGroupItem
                  value={key}
                  id={`${id}-${key}`}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={`${id}-${key}`}
                  className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-border bg-background p-4 hover:bg-accent peer-data-[state=checked]:border-primary"
                >
                  <span className="text-sm font-medium" aria-hidden="true">
                    {preset.label}
                  </span>
                  <span className="sr-only">{preset.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {preset.description}
                  </span>
                </Label>
              </div>
            ))}
          </RadioGroup>
          {showDescription && (
            <p className="text-sm text-muted-foreground">
              Controls randomness. Lower is more focused, higher is more creative.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {value.toFixed(1)}
            </span>
          </div>
          <Slider
            id={`${id}-slider`}
            aria-label="Temperature"
            min={0}
            max={2}
            step={0.1}
            value={[value]}
            onValueChange={(values) => onChange(values[0] || 0)}
            className="w-full"
          />
          {showDescription && (
            <p className="text-sm text-muted-foreground">
              Fine-tune the temperature value from 0 (deterministic) to 2 (very creative).
            </p>
          )}
        </>
      )}
    </div>
  );
}
