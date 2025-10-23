"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChatStore, type ProviderConfig } from "@/lib/chat-store";
import { ArrowLeft, Moon, Sun, Monitor, Plus, AlertCircle, ChevronDown } from "lucide-react";
import { ProviderCard } from "@/components/provider-card";
import { ProviderFormDialog } from "@/components/provider-form-dialog";
import { OpenAIProvider } from "@arc/ai/openai/OpenAIProvider.js";
import { AnthropicProvider } from "@arc/ai/anthropic/AnthropicProvider.js";
import { GeminiProvider } from "@arc/ai/gemini/GeminiProvider.js";
import { FetchHTTP } from "@arc/platform-browser/http/FetchHTTP.js";

const PROVIDER_NAMES: Record<ProviderConfig["provider"], string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

const AVAILABLE_PROVIDERS: ProviderConfig["provider"][] = ["openai", "anthropic", "google"];

export default function SettingsPage() {
  const theme = useChatStore((state) => state.theme);
  const setTheme = useChatStore((state) => state.setTheme);
  const fontSize = useChatStore((state) => state.fontSize);
  const setFontSize = useChatStore((state) => state.setFontSize);
  const providerConfigs = useChatStore((state) => state.providerConfigs);
  const addProvider = useChatStore((state) => state.addProvider);
  const updateProvider = useChatStore((state) => state.updateProvider);
  const deleteProvider = useChatStore((state) => state.deleteProvider);

  // Get available provider types (not yet configured)
  const availableProviderTypes = AVAILABLE_PROVIDERS.filter(
    (type) => !providerConfigs.some((config) => config.provider === type)
  );

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | undefined>(undefined);
  const [selectedProviderType, setSelectedProviderType] = useState<ProviderConfig["provider"]>("openai");

  // Test connection state
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleAddProvider = (providerType: ProviderConfig["provider"]) => {
    setDialogMode("add");
    setEditingProvider(undefined);
    setSelectedProviderType(providerType);
    setIsDialogOpen(true);
  };

  const handleEditProvider = (config: ProviderConfig) => {
    setDialogMode("edit");
    setEditingProvider(config);
    setIsDialogOpen(true);
  };

  const handleSaveProvider = (config: Partial<ProviderConfig>) => {
    if (dialogMode === "add") {
      // Check if provider already exists
      const exists = providerConfigs.some((p) => p.provider === config.provider);
      if (exists) {
        setTestError(`Provider ${config.provider} is already configured`);
        return;
      }
      addProvider(config as Omit<ProviderConfig, "id">);
    } else if (editingProvider) {
      updateProvider(editingProvider.id, config);
    }
    setTestError(null);
  };

  const handleDeleteProvider = (id: string, providerName: string) => {
    if (confirm(`Are you sure you want to delete ${providerName}? This action cannot be undone.`)) {
      deleteProvider(id);
    }
  };

  const handleTestProvider = async (config: ProviderConfig) => {
    setTestingProvider(config.provider);
    setTestError(null);

    try {
      const http = new FetchHTTP();

      let provider;
      if (config.provider === "openai") {
        provider = new OpenAIProvider(http, config.apiKey || "", config.baseUrl || undefined);
      } else if (config.provider === "anthropic") {
        provider = new AnthropicProvider(http, config.apiKey || "", {
          ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
          defaultMaxTokens: 4096,
        });
      } else if (config.provider === "google") {
        provider = new GeminiProvider(http, config.apiKey || "", {
          ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
        });
      } else {
        throw new Error(`Provider ${config.provider} is not supported`);
      }

      await provider.healthCheck();
      alert(`Connection to ${config.provider} successful!`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed";
      setTestError(`${config.provider}: ${message}`);
    } finally {
      setTestingProvider(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-semibold">Settings</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="space-y-6">
          {/* Appearance Section */}
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

          {/* AI Providers Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">AI Providers</h2>
                <p className="text-sm text-muted-foreground">
                  Configure multiple AI providers. Models from all providers will be available for use.
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button disabled={availableProviderTypes.length === 0}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Provider
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {availableProviderTypes.map((type) => (
                    <DropdownMenuItem key={type} onClick={() => handleAddProvider(type)}>
                      {PROVIDER_NAMES[type]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {testError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{testError}</AlertDescription>
              </Alert>
            )}

            {providerConfigs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground mb-4">
                    No providers configured yet. Add your first provider to get started.
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Provider
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center">
                      {AVAILABLE_PROVIDERS.map((type) => (
                        <DropdownMenuItem key={type} onClick={() => handleAddProvider(type)}>
                          {PROVIDER_NAMES[type]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {providerConfigs.map((config) => (
                  <ProviderCard
                    key={config.id}
                    config={config}
                    onEdit={() => handleEditProvider(config)}
                    onDelete={() => handleDeleteProvider(config.id, PROVIDER_NAMES[config.provider])}
                    onTest={() => handleTestProvider(config)}
                    isTesting={testingProvider === config.provider}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Provider Form Dialog */}
      <ProviderFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={handleSaveProvider}
        initialConfig={editingProvider}
        mode={dialogMode}
        preselectedProvider={dialogMode === "add" ? selectedProviderType : undefined}
      />
    </div>
  );
}
