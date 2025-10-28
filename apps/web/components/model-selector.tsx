"use client";

/**
 * ModelSelector - Enhanced model selector with search, grouping, and favorites
 *
 * Features:
 * - Fuzzy search across model IDs and provider names
 * - Models grouped by provider
 * - Favorites management with dedicated group
 * - In-context model management
 * - Skeleton loading states
 * - Empty state handling
 */

import { useState, useMemo, useEffect } from "react";
import Fuse from "fuse.js";
import { Check, ChevronsUpDown, Star, Settings2 } from "lucide-react";
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
import { useCore } from "@/lib/core-provider";
import { toast } from "sonner";
import { TOAST_DURATION } from "@/lib/error-handler";
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
  const core = useCore();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isManagementMode, setIsManagementMode] = useState(false);
  const [favoriteModels, setFavoriteModels] = useState<Set<string>>(new Set());

  // ============================================================================
  // Load Favorites from Settings
  // ============================================================================

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const settings = await core.settings.get();
        setFavoriteModels(new Set(settings.favoriteModels));
      } catch (error) {
        console.error("Failed to load favorite models:", error);
      }
    };

    void loadFavorites();
  }, [core]);

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

  // ============================================================================
  // Favorites Group
  // ============================================================================

  /**
   * Build favorites group from current favorites
   */
  const favoritesGroup = useMemo(() => {
    const favorites = allModels.filter((model) => {
      const key = `${model.providerId}:${model.id}`;
      return favoriteModels.has(key);
    });

    if (favorites.length === 0) return null;

    // Group favorites by provider to maintain structure
    const favoritesByProvider = new Map<string, typeof favorites>();
    favorites.forEach((model) => {
      const existing = favoritesByProvider.get(model.providerId) || [];
      favoritesByProvider.set(model.providerId, [...existing, model]);
    });

    // Return a flattened list with provider context
    return {
      label: "Favorites",
      models: favorites,
    };
  }, [allModels, favoriteModels]);

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

  /**
   * Filtered favorites based on search query
   */
  const filteredFavorites = useMemo(() => {
    if (!favoritesGroup) return null;
    if (!searchQuery.trim()) return favoritesGroup;

    const results = fuse.search(searchQuery);
    const matchedModelIds = new Set(results.map((r) => r.item.id));

    const filtered = favoritesGroup.models.filter((model) => matchedModelIds.has(model.id));
    return filtered.length > 0 ? { ...favoritesGroup, models: filtered } : null;
  }, [favoritesGroup, searchQuery, fuse]);

  // ============================================================================
  // Favorites Management
  // ============================================================================

  const handleToggleFavorite = async (modelId: string, providerId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const key = `${providerId}:${modelId}`;
    const newFavorites = new Set(favoriteModels);

    if (newFavorites.has(key)) {
      newFavorites.delete(key);
    } else {
      newFavorites.add(key);
    }

    // Optimistic update
    setFavoriteModels(newFavorites);

    try {
      await core.settings.update({
        favoriteModels: Array.from(newFavorites),
      });
      toast.success(
        newFavorites.has(key) ? "Model added to favorites" : "Model removed from favorites",
        { duration: TOAST_DURATION.short }
      );
    } catch (error) {
      // Rollback on error
      setFavoriteModels(favoriteModels);
      console.error("Failed to update favorites:", error);
      toast.error("Failed to update favorites", {
        duration: TOAST_DURATION.short,
      });
    }
  };

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

            {/* Favorites Group (shown first if exists and not in management mode) */}
            {filteredFavorites && !isManagementMode && (
              <>
                <CommandGroup heading={filteredFavorites.label}>
                  {filteredFavorites.models.map((model) => (
                    <CommandItem
                      key={`favorite-${model.providerId}-${model.id}`}
                      value={model.id}
                      onSelect={() => {
                        onValueChange(model.id, model.providerId);
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
                      <span className="truncate flex-1">{model.id}</span>
                      <Star className="ml-2 h-4 w-4 fill-yellow-400 text-yellow-400" />
                    </CommandItem>
                  ))}
                </CommandGroup>
                <Separator className="my-1" />
              </>
            )}

            {/* Provider Groups */}
            {filteredGroups.map((group, groupIndex) => (
              <div key={group.providerId}>
                {groupIndex > 0 && !filteredFavorites && <Separator className="my-1" />}
                {groupIndex > 0 && filteredFavorites && <Separator className="my-1" />}
                {groupIndex === 0 && filteredFavorites && groupIndex > 0 && <Separator className="my-1" />}
                <CommandGroup heading={group.providerName}>
                  {group.models.map((model) => {
                    const key = `${group.providerId}:${model.id}`;
                    const isFavorite = favoriteModels.has(key);

                    return (
                      <CommandItem
                        key={`${group.providerId}-${model.id}`}
                        value={model.id}
                        onSelect={() => {
                          if (!isManagementMode) {
                            onValueChange(model.id, group.providerId);
                            setOpen(false);
                            setSearchQuery("");
                          }
                        }}
                        className={cn(isManagementMode && "cursor-default")}
                      >
                        {!isManagementMode && (
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === model.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                        )}
                        <span className="truncate flex-1">{model.id}</span>
                        <button
                          onClick={(e) => handleToggleFavorite(model.id, group.providerId, e)}
                          className={cn(
                            "ml-2 h-4 w-4 flex items-center justify-center",
                            isManagementMode ? "cursor-pointer" : "cursor-default"
                          )}
                          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                        >
                          <Star
                            className={cn(
                              "h-4 w-4",
                              isFavorite
                                ? "fill-yellow-400 text-yellow-400"
                                : isManagementMode
                                  ? "text-muted-foreground hover:text-yellow-400"
                                  : "text-muted-foreground/30"
                            )}
                          />
                        </button>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </div>
            ))}
          </CommandList>

          {/* Footer with Management Toggle */}
          <div className="border-t p-2">
            {isManagementMode ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground px-2">
                  Click stars to favorite/unfavorite models
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setIsManagementMode(false)}
                >
                  Done
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => setIsManagementMode(true)}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Manage Models
              </Button>
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
