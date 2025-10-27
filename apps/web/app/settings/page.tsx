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
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { SettingsSidebar } from "@/components/settings-sidebar";
import { useUIStore } from "@/lib/ui-store";
import { ArrowLeft, Moon, Sun, Monitor, Plus, AlertCircle } from "lucide-react";
import { ProviderCard } from "@/components/provider-card";
import { ProviderFormDialog } from "@/components/provider-form-dialog";
import { About } from "@/components/about";
import { useCore } from "@/lib/core-provider";
import type { ProviderConfig } from "@arc/core/core.js";

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

  // Provider state
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([]);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | undefined>(undefined);

  // Test connection state
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load providers on mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const providers = await core.providers.list();
        setProviderConfigs(providers);
      } catch (error) {
        console.error("Failed to load providers:", error);
      }
    };

    void loadProviders();
  }, [core]);

  const handleAddProvider = () => {
    setDialogMode("add");
    setEditingProvider(undefined);
    setSuccessMessage(null);
    setIsDialogOpen(true);
  };

  const handleEditProvider = (config: ProviderConfig) => {
    setDialogMode("edit");
    setEditingProvider(config);
    setIsDialogOpen(true);
  };

  const handleSaveProvider = async (
    configData: Partial<ProviderConfig>
  ) => {
    try {
      if (dialogMode === "add") {
        // Check if provider type already exists
        const exists = providerConfigs.some((p) => p.type === configData.type);
        if (exists) {
          setTestError(`Provider ${configData.type} is already configured`);
          return;
        }

        // Create provider
        await core.providers.create({
          name: configData.name || `${configData.type} Provider`,
          type: configData.type as ProviderConfig["type"],
          apiKey: configData.apiKey || "",
          baseUrl: configData.baseUrl || "",
          enabled: configData.enabled ?? true,
          ...(configData.customHeaders && { customHeaders: configData.customHeaders }),
          ...(configData.defaultModel && { defaultModel: configData.defaultModel }),
        });

        setSuccessMessage(`Provider added successfully`);
        setTimeout(() => setSuccessMessage(null), 5000);
      } else if (editingProvider) {
        // Update provider
        await core.providers.update(editingProvider.id, {
          ...(configData.name !== undefined && { name: configData.name }),
          ...(configData.apiKey !== undefined && { apiKey: configData.apiKey }),
          ...(configData.baseUrl !== undefined && { baseUrl: configData.baseUrl }),
          ...(configData.customHeaders !== undefined && { customHeaders: configData.customHeaders }),
          ...(configData.defaultModel !== undefined && { defaultModel: configData.defaultModel }),
          ...(configData.enabled !== undefined && { enabled: configData.enabled }),
        });
      }

      setTestError(null);
      setIsDialogOpen(false);

      // Reload providers
      const providers = await core.providers.list();
      setProviderConfigs(providers);
    } catch (error) {
      console.error("Failed to save provider:", error);
      setTestError(error instanceof Error ? error.message : "Failed to save provider");
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
      alert(`Connection to ${config.name} successful!`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed";
      setTestError(`${config.name}: ${message}`);
    } finally {
      setTestingProvider(null);
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

            {successMessage && (
              <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}

            {providerConfigs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground mb-4">
                    No providers configured yet. Add your first provider to get started.
                  </p>
                  <Button onClick={handleAddProvider}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Provider
                  </Button>
                </CardContent>
              </Card>
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
        />
      )}
    </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
