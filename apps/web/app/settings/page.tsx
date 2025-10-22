"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChatStore, type ProviderConfig } from "@/lib/chat-store";
import { ArrowLeft, Moon, Sun, Monitor, Check, X, Loader2 } from "lucide-react";
import { OpenAIAdapter } from "@arc/core/providers/openai/OpenAIAdapter.js";
import { FetchHTTP } from "@arc/platform-browser/http/FetchHTTP.js";

const OPENAI_MODELS = [
  { value: "gpt-4-turbo-preview", label: "GPT-4 Turbo" },
  { value: "gpt-4", label: "GPT-4" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  { value: "gpt-3.5-turbo-16k", label: "GPT-3.5 Turbo 16K" },
];

type TestStatus = "idle" | "testing" | "success" | "error";

export default function SettingsPage() {
  const theme = useChatStore((state) => state.theme);
  const setTheme = useChatStore((state) => state.setTheme);
  const fontSize = useChatStore((state) => state.fontSize);
  const setFontSize = useChatStore((state) => state.setFontSize);
  const providerConfig = useChatStore((state) => state.providerConfig);
  const setProviderConfig = useChatStore((state) => state.setProviderConfig);

  // Local form state for provider settings
  const [provider, setProvider] = useState<ProviderConfig["provider"]>(
    providerConfig?.provider || "openai"
  );
  const [apiKey, setApiKey] = useState(providerConfig?.apiKey || "");
  const [baseUrl, setBaseUrl] = useState(providerConfig?.baseUrl || "");
  const [model, setModel] = useState(providerConfig?.model || "gpt-4-turbo-preview");

  // Test connection state
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");

  const hasChanges =
    provider !== (providerConfig?.provider || "openai") ||
    apiKey !== (providerConfig?.apiKey || "") ||
    baseUrl !== (providerConfig?.baseUrl || "") ||
    model !== (providerConfig?.model || "");

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestStatus("error");
      setTestMessage("API key is required");
      return;
    }

    setTestStatus("testing");
    setTestMessage("");

    try {
      const http = new FetchHTTP();
      const adapter = new OpenAIAdapter(http, apiKey, baseUrl || undefined);
      await adapter.healthCheck();

      setTestStatus("success");
      setTestMessage("Connection successful!");
    } catch (error) {
      setTestStatus("error");
      if (error instanceof Error) {
        setTestMessage(error.message || "Connection failed");
      } else {
        setTestMessage("Connection failed");
      }
    }
  };

  const handleSaveProvider = () => {
    if (!apiKey.trim()) {
      setTestStatus("error");
      setTestMessage("API key is required");
      return;
    }

    const config: ProviderConfig = {
      provider,
      apiKey,
      ...(baseUrl && { baseUrl }),
      ...(model && { model }),
    };

    setProviderConfig(config);
    setTestStatus("idle");
    setTestMessage("");
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

          {/* Provider Configuration Section */}
          <Card>
            <CardHeader>
              <CardTitle>AI Provider</CardTitle>
              <CardDescription>
                Configure your AI provider settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Provider Selection */}
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select
                  value={provider}
                  onValueChange={(value) => setProvider(value as ProviderConfig["provider"])}
                >
                  <SelectTrigger id="provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Coming Soon)</SelectItem>
                    <SelectItem value="google">Google (Coming Soon)</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label htmlFor="apiKey">
                  API Key <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Your API key is stored locally and never sent to our servers
                </p>
              </div>

              {/* Base URL */}
              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL (Optional)</Label>
                <Input
                  id="baseUrl"
                  type="url"
                  placeholder="https://api.openai.com/v1"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  For proxies or custom endpoints
                </p>
              </div>

              {/* Model Selection */}
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPENAI_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Test Connection */}
              <div className="space-y-2">
                <Button
                  onClick={handleTestConnection}
                  disabled={!apiKey.trim() || testStatus === "testing"}
                  variant="outline"
                  className="w-full"
                >
                  {testStatus === "testing" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing Connection...
                    </>
                  ) : testStatus === "success" ? (
                    <>
                      <Check className="mr-2 h-4 w-4 text-green-600" />
                      Connection Successful
                    </>
                  ) : testStatus === "error" ? (
                    <>
                      <X className="mr-2 h-4 w-4 text-destructive" />
                      Connection Failed
                    </>
                  ) : (
                    "Test Connection"
                  )}
                </Button>
                {testMessage && (
                  <p
                    className={`text-sm ${
                      testStatus === "success"
                        ? "text-green-600"
                        : "text-destructive"
                    }`}
                  >
                    {testMessage}
                  </p>
                )}
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSaveProvider}
                disabled={!hasChanges || !apiKey.trim()}
                className="w-full"
              >
                Save Provider Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
