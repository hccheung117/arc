"use client";

import { useState } from "react";
import { Settings, Check, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useChatStore } from "@/lib/chat-store";
import { OpenAIAdapter } from "@arc/core/providers/openai/OpenAIAdapter.js";
import { FetchHTTP } from "@arc/platform-browser/http/FetchHTTP.js";

const MODELS = [
  { value: "gpt-4-turbo-preview", label: "GPT-4 Turbo" },
  { value: "gpt-4", label: "GPT-4" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  { value: "gpt-3.5-turbo-16k", label: "GPT-3.5 Turbo 16K" },
];

type TestStatus = "idle" | "testing" | "success" | "error";

export function SettingsDialog() {
  const { providerSettings, updateProviderSettings } = useChatStore();
  const [open, setOpen] = useState(false);

  // Local form state
  const [apiKey, setApiKey] = useState(providerSettings.apiKey);
  const [baseUrl, setBaseUrl] = useState(providerSettings.baseUrl);
  const [model, setModel] = useState(providerSettings.model);

  // Test connection state
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");

  const hasChanges =
    apiKey !== providerSettings.apiKey ||
    baseUrl !== providerSettings.baseUrl ||
    model !== providerSettings.model;

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
      const adapter = new OpenAIAdapter(http, apiKey, baseUrl);
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

  const handleSave = () => {
    updateProviderSettings({
      apiKey,
      baseUrl,
      model,
    });
    setOpen(false);
  };

  const handleCancel = () => {
    // Reset to saved values
    setApiKey(providerSettings.apiKey);
    setBaseUrl(providerSettings.baseUrl);
    setModel(providerSettings.model);
    setTestStatus("idle");
    setTestMessage("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Settings">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your OpenAI API connection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
              Your OpenAI API key. Get one at{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                platform.openai.com/api-keys
              </a>
            </p>
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input
              id="baseUrl"
              type="url"
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Optional. Use a custom endpoint or proxy.
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
                {MODELS.map((m) => (
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
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
