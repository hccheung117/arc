"use client";

/**
 * ModelSelector - Enhanced model selector with search and grouping
 *
 * Features:
 * - Fuzzy search across model IDs and provider names
 * - Models grouped by provider
 * - Skeleton loading states
 * - Empty state handling
 */

import { useState, useMemo } from "react";
import Fuse from "fuse.js";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ProviderModelGroup } from "@/lib/use-models";

// ============================================================================
// Types
// ============================================================================

interface ModelSelectorProps {
  /**
   * Selected model ID
   */
  value: string;

  /**
   * Callback when model selection changes
   */
  onValueChange: (modelId: string, providerId: string) => void;

  /**
   * Whether the selector is disabled
   */
  disabled?: boolean;

  /**
   * Models grouped by provider
   */
  groupedModels: ProviderModelGroup[];

  /**
   * Whether models are currently loading
   */
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ModelSelector({
  value,
  onValueChange,
  disabled = false,
  groupedModels = [],
  isLoading = false,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ============================================================================
  // Fuzzy Search Implementation
  // ============================================================================

  /**
   * Flatten all models for search
   */
  const allModels = useMemo(() => {
    return groupedModels.flatMap((group) =>
      group.models.map((model) => ({
        id: model.id,
        providerId: group.providerId,
        providerName: group.providerName,
        providerType: group.providerType,
        displayName: `${model.id} (${group.providerName})`,
      }))
    );
  }, [groupedModels]);

  /**
   * Fuse.js instance for fuzzy search
   */
  const fuse = useMemo(() => {
    return new Fuse(allModels, {
      keys: ["id", "providerName", "providerType"],
      threshold: 0.3, // 0 = perfect match, 1 = match anything
      ignoreLocation: true,
    });
  }, [allModels]);

  /**
   * Filtered models based on search query
   */
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return groupedModels;
    }

    // Use fuzzy search
    const results = fuse.search(searchQuery);
    const matchedModelIds = new Set(results.map((r) => r.item.id));

    // Filter groups to only include matched models
    return groupedModels
      .map((group) => ({
        ...group,
        models: group.models.filter((model) => matchedModelIds.has(model.id)),
      }))
      .filter((group) => group.models.length > 0);
  }, [searchQuery, groupedModels, fuse]);

  // ============================================================================
  // Selected Model Display
  // ============================================================================

  const selectedModel = useMemo(() => {
    return allModels.find((model) => model.id === value);
  }, [allModels, value]);

  const displayValue = selectedModel
    ? `${selectedModel.id.length > 30 ? selectedModel.id.slice(0, 30) + "..." : selectedModel.id}`
    : "Select a model";

  // ============================================================================
  // Loading State
  // ============================================================================

  if (isLoading) {
    return (
      <div className="w-[280px]">
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  // ============================================================================
  // Empty State
  // ============================================================================

  if (groupedModels.length === 0) {
    return (
      <Button variant="outline" disabled className="w-[280px] justify-between">
        No models available
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-[280px] justify-between"
        >
          {displayValue}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search models..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No models found.</CommandEmpty>
            {filteredGroups.map((group, groupIndex) => (
              <div key={group.providerId}>
                {groupIndex > 0 && <Separator className="my-1" />}
                <CommandGroup heading={group.providerName}>
                  {group.models.map((model) => (
                    <CommandItem
                      key={`${group.providerId}-${model.id}`}
                      value={model.id}
                      onSelect={() => {
                        onValueChange(model.id, group.providerId);
                        setOpen(false);
                        setSearchQuery("");
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === model.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{model.id}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
