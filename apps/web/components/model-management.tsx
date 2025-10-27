"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, Filter } from "lucide-react";
import { useCore } from "@/lib/core-provider";
import { useModels } from "@/lib/use-models";
import { toast } from "sonner";
import { TOAST_DURATION } from "@/lib/error-handler";
import type { Settings } from "@arc/core/core.js";

export function ModelManagement() {
  const core = useCore();
  const { groupedModels, isLoading: modelsLoading } = useModels();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [favoriteModels, setFavoriteModels] = useState<Set<string>>(new Set());
  const [whitelistedModels, setWhitelistedModels] = useState<Set<string>>(new Set());
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const currentSettings = await core.settings.get();
        setSettings(currentSettings);
        setFavoriteModels(new Set(currentSettings.favoriteModels));
        setWhitelistedModels(new Set(currentSettings.whitelistedModels));
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };

    void loadSettings();
  }, [core]);

  const handleToggleFavorite = async (providerId: string, modelId: string) => {
    const key = `${providerId}:${modelId}`;
    const newFavorites = new Set(favoriteModels);

    if (newFavorites.has(key)) {
      newFavorites.delete(key);
    } else {
      newFavorites.add(key);
    }

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

  const handleSaveWhitelist = async () => {
    setIsSaving(true);
    try {
      await core.settings.update({
        whitelistedModels: Array.from(whitelistedModels),
      });
      setIsFilterDialogOpen(false);
      toast.success("Model filter updated", {
        duration: TOAST_DURATION.short,
      });
    } catch (error) {
      console.error("Failed to update whitelist:", error);
      toast.error("Failed to update model filter", {
        duration: TOAST_DURATION.short,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleWhitelist = (providerId: string, modelId: string) => {
    const key = `${providerId}:${modelId}`;
    const newWhitelist = new Set(whitelistedModels);

    if (newWhitelist.has(key)) {
      newWhitelist.delete(key);
    } else {
      newWhitelist.add(key);
    }

    setWhitelistedModels(newWhitelist);
  };

  const handleClearWhitelist = () => {
    setWhitelistedModels(new Set());
  };

  if (!settings) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Model Management</CardTitle>
            <CardDescription>
              Star your favorite models for quick access and filter which models appear in the model selector
            </CardDescription>
          </div>
          <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter Models {whitelistedModels.size > 0 && `(${whitelistedModels.size})`}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Filter Models</DialogTitle>
                <DialogDescription>
                  Select which models you want to see in the model selector. Leave empty to show all models.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-6">
                  {groupedModels.map((group) => (
                    <div key={group.providerId} className="space-y-2">
                      <h4 className="font-medium text-sm">{group.providerName}</h4>
                      <div className="space-y-2 pl-4">
                        {group.models.map((model) => {
                          const key = `${group.providerId}:${model.id}`;
                          return (
                            <div key={model.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`whitelist-${key}`}
                                checked={whitelistedModels.has(key)}
                                onCheckedChange={() =>
                                  handleToggleWhitelist(group.providerId, model.id)
                                }
                              />
                              <Label
                                htmlFor={`whitelist-${key}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {model.id}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={handleClearWhitelist}
                  disabled={whitelistedModels.size === 0}
                >
                  Clear All
                </Button>
                <Button onClick={handleSaveWhitelist} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Filter"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {modelsLoading ? (
          <div className="text-sm text-muted-foreground">Loading models...</div>
        ) : groupedModels.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No models available. Please configure an AI provider first.
          </div>
        ) : (
          <div className="space-y-6">
            {groupedModels.map((group) => (
              <div key={group.providerId} className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground">
                  {group.providerName}
                </h3>
                <div className="grid gap-2">
                  {group.models.map((model) => {
                    const key = `${group.providerId}:${model.id}`;
                    const isFavorite = favoriteModels.has(key);
                    const isFiltered =
                      whitelistedModels.size > 0 && !whitelistedModels.has(key);

                    return (
                      <div
                        key={model.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isFiltered
                            ? "opacity-50 bg-muted/30"
                            : "bg-card hover:bg-accent/50"
                        } transition-colors`}
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">{model.id}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleFavorite(group.providerId, model.id)}
                          className="ml-2"
                        >
                          <Star
                            className={`h-4 w-4 ${
                              isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                            }`}
                          />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
