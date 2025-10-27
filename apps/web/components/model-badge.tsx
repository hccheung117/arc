"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProviderConfig } from "@arc/core/core.js";

interface ModelBadgeProps {
  /**
   * The model ID/name (e.g., "gpt-4", "claude-3-opus")
   */
  model: string | undefined;

  /**
   * The provider connection ID
   */
  providerConnectionId: string | undefined;

  /**
   * List of all provider configurations to resolve provider name
   */
  providers: ProviderConfig[];
}

/**
 * ModelBadge component displays the AI model name in a subtle badge
 * with provider information shown in a tooltip on hover.
 *
 * Handles missing data gracefully:
 * - Shows "Unknown Model" if model is undefined
 * - Shows "Unknown Provider" if provider is not found
 * - Shows warning tooltip if provider has been deleted
 */
export function ModelBadge({
  model,
  providerConnectionId,
  providers,
}: ModelBadgeProps) {
  // Handle missing model
  const displayModel = model || "Unknown Model";

  // Resolve provider name
  let providerName = "Unknown Provider";
  let providerDeleted = false;

  if (providerConnectionId) {
    const provider = providers.find((p) => p.id === providerConnectionId);
    if (provider) {
      providerName = provider.name;
    } else {
      // Provider exists in message but not in current providers list
      providerDeleted = true;
      providerName = "Deleted Provider";
    }
  }

  // Build tooltip content
  const tooltipContent = (
    <div className="space-y-1">
      <div>
        <span className="font-medium">Model:</span> {displayModel}
      </div>
      <div>
        <span className="font-medium">Provider:</span> {providerName}
      </div>
      {providerDeleted && (
        <div className="text-yellow-300 text-xs mt-1">
          ⚠ This provider configuration has been deleted
        </div>
      )}
    </div>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-block">
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 cursor-help"
          >
            {displayModel}
          </Badge>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}
