"use client";

import { Separator } from "@/components/ui/separator";
import type { ProviderConfig } from "@arc/core/core.js";

interface ModelSwitchDividerProps {
  /**
   * The new model being switched to
   */
  model: string | undefined;

  /**
   * The provider connection ID for the new model
   */
  providerConnectionId: string | undefined;

  /**
   * List of all provider configurations to resolve provider name
   */
  providers: ProviderConfig[];
}

/**
 * ModelSwitchDivider component shows a visual divider when the AI model
 * changes mid-conversation.
 *
 * Displays: "Switched to [Model Name] ([Provider Name])"
 * Fallback: "Model changed" if names are unavailable
 */
export function ModelSwitchDivider({
  model,
  providerConnectionId,
  providers,
}: ModelSwitchDividerProps) {
  // Build the display text
  let displayText = "Model changed";

  if (model) {
    // Resolve provider name
    let providerName: string | undefined;

    if (providerConnectionId) {
      const provider = providers.find((p) => p.id === providerConnectionId);
      if (provider) {
        providerName = provider.name;
      }
    }

    // Format: "Switched to [Model] ([Provider])" or "Switched to [Model]"
    if (providerName) {
      displayText = `Switched to ${model} (${providerName})`;
    } else {
      displayText = `Switched to ${model}`;
    }
  }

  return (
    <div className="flex items-center gap-3 my-6 px-4">
      <Separator className="flex-1" />
      <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
        {displayText}
      </span>
      <Separator className="flex-1" />
    </div>
  );
}
