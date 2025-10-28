"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { SettingsSidebar } from "@/components/settings-sidebar";
import { useUIStore } from "@/lib/ui-store";
import { ArrowLeft, Moon, Sun, Monitor, Plus, AlertCircle } from "lucide-react";
import { ProviderCard } from "@/components/provider-card";
import { ProviderFormDialog } from "@/components/provider-form-dialog";
import { About } from "@/components/about";
import { ProviderListSkeleton } from "@/components/skeletons";
import { EmptyProviderListState } from "@/components/empty-states";
import { TemperatureSelector } from "@/components/temperature-selector";
import { useCore } from "@/lib/core-provider";
import { toast } from "sonner";
import { TOAST_DURATION } from "@/lib/error-handler";
import type { ProviderConfig, Settings } from "@arc/core/core.js";

// Payload type for provider save operations
type ProviderSavePayload =
  | { type: "auto"; name: string; apiKey: string; baseUrl: string }
  | Partial<ProviderConfig>;

const PROVIDER_NAMES: Record<ProviderConfig["type"], string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  custom: "Custom",
};

export default function SettingsPage() {
  const core = useCore();
  const searchParams = useSearchParams();
  const activeTab = searchParams?.get("tab") || "appearance";

  // UI state from Zustand
  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);
  const fontSize = useUIStore((state) => state.fontSize);
  const setFontSize = useUIStore((state) => state.setFontSize);

  // Core settings state
  const [coreSettings, setCoreSettings] = useState<Settings | null>({
    lineHeight: "normal",
    fontFamily: "sans",
    defaultSystemPrompt: "",
    autoTitleChats: true,
  } as Settings);

  // Provider state
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | undefined>(undefined);

  // Test connection state
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await core.settings.get();
        setCoreSettings(settings);
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };

    void loadSettings();
  }, [core]);

  // Load providers on mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        setIsLoadingProviders(true);
        const providers = await core.providers.list();
        setProviderConfigs(providers);
      } catch (error) {
        console.error("Failed to load providers:", error);
      } finally {
        setIsLoadingProviders(false);
      }
    };

    void loadProviders();
  }, [core]);

  const handleAddProvider = () => {
    setDialogMode("add");
    setEditingProvider(undefined);
    setTestError(null);
    setIsDialogOpen(true);
  };

  const handleEditProvider = (config: ProviderConfig) => {
    setDialogMode("edit");
    setEditingProvider(config);
    setIsDialogOpen(true);
  };

  const handleSaveProvider = async (
    configData: ProviderSavePayload
  ) => {
    try {
      setIsSaving(true);
      setTestError(null);

      if (dialogMode === "add") {
        // For "auto" type, let core auto-detect the provider type
        const isAutoType = "type" in configData && configData.type === "auto";

        if (!isAutoType) {
          // Check if provider type already exists (only for explicit types)
          const exists = providerConfigs.some((p) => p.type === configData.type);
          if (exists) {
            setTestError(`Provider ${configData.type} is already configured`);
            setIsSaving(false);
            return;
          }
        }

        // Create provider
        if (isAutoType) {
          // Auto-detect provider type
          await core.providers.create({
            name: configData.name,
            type: "openai", // Core will auto-detect actual type based on baseUrl
            apiKey: configData.apiKey,
            baseUrl: configData.baseUrl,
            enabled: true,
          });
        } else {
          // Explicit provider type
          await core.providers.create({
            name: configData.name || `${configData.type} Provider`,
            type: configData.type as ProviderConfig["type"],
            apiKey: configData.apiKey || "",
            baseUrl: configData.baseUrl || "",
            enabled: configData.enabled ?? true,
            ...(configData.customHeaders && { customHeaders: configData.customHeaders }),
            ...(configData.defaultModel && { defaultModel: configData.defaultModel }),
          });
        }

        toast.success("Provider added successfully", {
          duration: TOAST_DURATION.short,
        });
      } else if (editingProvider) {
        // Update provider - in edit mode, configData is always Partial<ProviderConfig>
        // (never the auto type variant)
        const updateData = configData as Partial<ProviderConfig>;
        await core.providers.update(editingProvider.id, {
          ...(updateData.name !== undefined && { name: updateData.name }),
          ...(updateData.apiKey !== undefined && { apiKey: updateData.apiKey }),
          ...(updateData.baseUrl !== undefined && { baseUrl: updateData.baseUrl }),
          ...(updateData.customHeaders !== undefined && { customHeaders: updateData.customHeaders }),
          ...(updateData.defaultModel !== undefined && { defaultModel: updateData.defaultModel }),
          ...(updateData.enabled !== undefined && { enabled: updateData.enabled }),
        });

        toast.success("Provider updated successfully", {
          duration: TOAST_DURATION.short,
        });
      }

      setIsDialogOpen(false);

      // Reload providers
      const providers = await core.providers.list();
      setProviderConfigs(providers);
    } catch (error) {
      console.error("Failed to save provider:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save provider";
      setTestError(errorMessage);
      toast.error("Failed to save provider", {
        description: errorMessage,
        duration: TOAST_DURATION.long,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProvider = async (id: string, providerName: string) => {
    if (confirm(`Are you sure you want to delete ${providerName}? This action cannot be undone.`)) {
      try {
        await core.providers.delete(id);

        // Reload providers
        const providers = await core.providers.list();
        setProviderConfigs(providers);
      } catch (error) {
        console.error("Failed to delete provider:", error);
        setTestError(error instanceof Error ? error.message : "Failed to delete provider");
      }
    }
  };

  const handleTestProvider = async (config: ProviderConfig) => {
    setTestingProvider(config.id);
    setTestError(null);

    try {
      await core.providers.checkConnection(config.id);
      toast.success(`Connection to ${config.name} successful!`, {
        duration: TOAST_DURATION.short,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed";
      const errorMsg = `${config.name}: ${message}`;
      setTestError(errorMsg);

      // Auto-dismiss error after 8 seconds
      setTimeout(() => setTestError(null), TOAST_DURATION.long);

      toast.error("Connection failed", {
        description: message,
        duration: TOAST_DURATION.long,
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const handleUpdateTypography = async (updates: Partial<Settings>) => {
    if (!coreSettings) return;

    // Optimistic update
    const previousSettings = coreSettings;
    setCoreSettings({ ...coreSettings, ...updates });

    try {
      await core.settings.update(updates);
      toast.success("Typography updated", {
        duration: TOAST_DURATION.short,
      });
    } catch (error) {
      // Rollback on error
      setCoreSettings(previousSettings);
      console.error("Failed to update typography:", error);
      toast.error("Failed to update typography", {
        duration: TOAST_DURATION.short,
      });
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <SettingsSidebar activeTab={activeTab} />
      <SidebarInset>
        <div className="min-h-screen bg-background">
          {/* Header */}
          <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
            <div className="flex items-center gap-4 px-4 py-4">
              <SidebarTrigger />
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-2xl font-semibold">Settings</h1>
            </div>
          </header>

          {/* Content */}
          <main className="px-4 py-8">
            <div className="space-y-6 mx-auto max-w-4xl">
              {/* Appearance Section */}
              {activeTab === "appearance" && (
                <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize how Arc looks and feels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme Switcher */}
              <div className="space-y-3">
                <Label htmlFor="theme">Theme</Label>
                <RadioGroup
                  id="theme"
                  value={theme}
                  onValueChange={(value) => setTheme(value as "light" | "dark" | "system")}
                  className="grid grid-cols-3 gap-4"
                >
                  <div>
                    <RadioGroupItem
                      value="light"
                      id="light"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="light"
                      className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-border bg-background p-4 hover:bg-accent peer-data-[state=checked]:border-primary"
                    >
                      <Sun className="h-6 w-6" />
                      <span className="text-sm font-medium">Light</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem
                      value="dark"
                      id="dark"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="dark"
                      className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-border bg-background p-4 hover:bg-accent peer-data-[state=checked]:border-primary"
                    >
                      <Moon className="h-6 w-6" />
                      <span className="text-sm font-medium">Dark</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem
                      value="system"
                      id="system"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="system"
                      className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-border bg-background p-4 hover:bg-accent peer-data-[state=checked]:border-primary"
                    >
                      <Monitor className="h-6 w-6" />
                      <span className="text-sm font-medium">System</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Font Size Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="font-size">Font Size</Label>
                  <span className="text-sm text-muted-foreground">{fontSize}px</span>
                </div>
                <Slider
                  id="font-size"
                  min={12}
                  max={20}
                  step={1}
                  value={[fontSize]}
                  aria-label="Font Size"
                  onValueChange={(values) => {
                    if (values[0] !== undefined) {
                      setFontSize(values[0]);
                    }
                  }}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Adjust the base font size for better readability
                </p>
              </div>

              {/* Line Height */}
              {coreSettings && (
                <div className="space-y-3">
                  <Label htmlFor="line-height">Line Height</Label>
                  <RadioGroup
                    id="line-height"
                    value={coreSettings.lineHeight}
                    onValueChange={(value) => handleUpdateTypography({ lineHeight: value as "compact" | "normal" | "relaxed" })}
                    className="grid grid-cols-3 gap-4"
                  >
                    <div>
                      <RadioGroupItem
                        value="compact"
                        id="compact"
                        className="peer sr-only"
                      />
                    <Label
                        htmlFor="compact"
                        className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-border bg-background p-4 hover:bg-accent peer-data-[state=checked]:border-primary"
                      >
                      <span className="text-sm font-medium">Compact</span>
                        <span className="text-xs text-muted-foreground">1.4</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem
                        value="normal"
                        id="normal"
                        className="peer sr-only"
                      />
                    <Label
                        htmlFor="normal"
                        className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-border bg-background p-4 hover:bg-accent peer-data-[state=checked]:border-primary"
                      >
                      <span className="text-sm font-medium">Normal</span>
                        <span className="text-xs text-muted-foreground">1.6</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem
                        value="relaxed"
                        id="relaxed"
                        className="peer sr-only"
                      />
                    <Label
                        htmlFor="relaxed"
                        className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-border bg-background p-4 hover:bg-accent peer-data-[state=checked]:border-primary"
                      >
                      <span className="text-sm font-medium">Relaxed</span>
                        <span className="text-xs text-muted-foreground">1.8</span>
                      </Label>
                    </div>
                  </RadioGroup>
                  <p className="text-sm text-muted-foreground">
                    Adjust spacing between lines for better readability
                  </p>
                </div>
              )}

              {/* Font Family */}
              {coreSettings && (
                <div className="space-y-3">
                  <Label htmlFor="font-family">Font Family</Label>
                  <RadioGroup
                    id="font-family"
                    value={coreSettings.fontFamily}
                    onValueChange={(value) => handleUpdateTypography({ fontFamily: value as "sans" | "serif" | "mono" })}
                    className="grid grid-cols-3 gap-4"
                  >
                    <div>
                      <RadioGroupItem
                        value="sans"
                        id="sans"
                        className="peer sr-only"
                      />
                    <Label
                        htmlFor="sans"
                        className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-border bg-background p-4 hover:bg-accent peer-data-[state=checked]:border-primary"
                      >
                      <span className="text-sm font-medium font-sans">Sans Serif</span>
                        <span className="text-xs text-muted-foreground">Ag</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem
                        value="serif"
                        id="serif"
                        className="peer sr-only"
                      />
                    <Label
                        htmlFor="serif"
                        className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-border bg-background p-4 hover:bg-accent peer-data-[state=checked]:border-primary"
                      >
                      <span className="text-sm font-medium font-serif">Serif</span>
                        <span className="text-xs text-muted-foreground">Ag</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem
                        value="mono"
                        id="mono"
                        className="peer sr-only"
                      />
                    <Label
                        htmlFor="mono"
                        className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-border bg-background p-4 hover:bg-accent peer-data-[state=checked]:border-primary"
                      >
                      <span className="text-sm font-medium font-mono">Monospace</span>
                        <span className="text-xs text-muted-foreground">Ag</span>
                      </Label>
                    </div>
                  </RadioGroup>
                  <p className="text-sm text-muted-foreground">
                    Choose the font style for message content
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
              )}

          {/* AI Behavior Section */}
          {activeTab === "ai-behavior" && coreSettings && (
            <Card>
              <CardHeader>
                <CardTitle>AI Behavior</CardTitle>
                <CardDescription>
                  Configure default AI behavior and settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Default System Prompt */}
                <div className="space-y-3">
                  <Label htmlFor="default-system-prompt">Default System Prompt</Label>
                  <Textarea
                    id="default-system-prompt"
                    placeholder="You are a helpful assistant. (Leave empty to use model defaults)"
                    value={coreSettings.defaultSystemPrompt || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleUpdateTypography(
                        value ? { defaultSystemPrompt: value } : { defaultSystemPrompt: "" }
                      );
                    }}
                    rows={4}
                    className="resize-y"
                  />
                  <p className="text-sm text-muted-foreground">
                    Set a default system prompt that will be used for new conversations. You can override this per-message using advanced controls.
                  </p>
                </div>

                {/* Default Temperature */}
                <TemperatureSelector
                  value={coreSettings.defaultTemperature ?? 1.0}
                  onChange={(value) => handleUpdateTypography({ defaultTemperature: value })}
                  id="default-temperature"
                  showLabel={true}
                  showDescription={true}
                />

                {/* Auto-title Chats Toggle */}
                <div className="flex items-center justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="auto-title">Automatically Generate Chat Titles</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically generate descriptive titles for chats after the first exchange
                    </p>
                  </div>
                  <Switch
                    id="auto-title"
                    aria-label="Automatically Generate Chat Titles"
                    checked={coreSettings.autoTitleChats}
                    onCheckedChange={(checked) => handleUpdateTypography({ autoTitleChats: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Providers Section */}
          {activeTab === "providers" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">AI Providers</h2>
                <p className="text-sm text-muted-foreground">
                  Configure multiple AI providers.
                </p>
              </div>
              <Button onClick={handleAddProvider}>
                <Plus className="h-4 w-4 mr-2" />
                Add Provider
              </Button>
            </div>

            {testError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{testError}</AlertDescription>
              </Alert>
            )}

            {isLoadingProviders ? (
              <ProviderListSkeleton />
            ) : providerConfigs.length === 0 ? (
              <EmptyProviderListState onAddProvider={handleAddProvider} />
            ) : (
              <div className="grid gap-4">
                {providerConfigs.map((config) => (
                  <ProviderCard
                    key={config.id}
                    config={config}
                    onEdit={() => handleEditProvider(config)}
                    onDelete={() => handleDeleteProvider(config.id, PROVIDER_NAMES[config.type] || config.name)}
                    onTest={() => handleTestProvider(config)}
                    isTesting={testingProvider === config.id}
                  />
                ))}
              </div>
            )}
          </div>
          )}

          {/* About Section */}
          {activeTab === "about" && <About />}
        </div>
      </main>

      {/* Provider Form Dialog */}
      {isDialogOpen && (
        <ProviderFormDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onSave={handleSaveProvider}
          initialConfig={editingProvider}
          mode={dialogMode}
          isSaving={isSaving}
        />
      )}
    </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
