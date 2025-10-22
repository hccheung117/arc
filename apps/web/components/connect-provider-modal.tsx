"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChatStore, type ProviderConfig } from "@/lib/chat-store";

interface ConnectProviderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormErrors {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
}

export function ConnectProviderModal({ open, onOpenChange }: ConnectProviderModalProps) {
  const setProviderConfig = useChatStore((state) => state.setProviderConfig);

  const [provider, setProvider] = useState<ProviderConfig["provider"]>("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (field: string, value: string): string | undefined => {
    switch (field) {
      case "apiKey":
        if (!value.trim()) {
          return "API Key is required";
        }
        if (value.length < 10) {
          return "API Key seems too short";
        }
        break;
      case "baseUrl":
        if (value && !value.match(/^https?:\/\/.+/)) {
          return "Base URL must start with http:// or https://";
        }
        break;
    }
    return undefined;
  };

  const handleBlur = (field: string, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, value);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const newErrors: FormErrors = {};
    const apiKeyError = validateField("apiKey", apiKey);
    const baseUrlError = validateField("baseUrl", baseUrl);

    if (apiKeyError) newErrors.apiKey = apiKeyError;
    if (baseUrlError) newErrors.baseUrl = baseUrlError;

    // Mark all fields as touched
    setTouched({
      provider: true,
      apiKey: true,
      baseUrl: true,
    });

    // Update errors
    setErrors(newErrors);

    // Check if there are any errors
    const hasErrors = Object.keys(newErrors).length > 0;

    if (!hasErrors) {
      // Save configuration (non-functional for S3, just updates state)
      const config: ProviderConfig = {
        provider,
        apiKey,
        ...(baseUrl && { baseUrl }),
        ...(model && { model }),
      };

      setProviderConfig(config);

      // Close modal
      onOpenChange(false);

      // Reset form
      setApiKey("");
      setBaseUrl("");
      setModel("");
      setErrors({});
      setTouched({});
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    // Reset form
    setApiKey("");
    setBaseUrl("");
    setModel("");
    setErrors({});
    setTouched({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Connect AI Provider</DialogTitle>
          <DialogDescription>
            Enter your API credentials to start chatting. Your keys are stored locally and never sent to our servers.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={provider}
                onValueChange={(value) => setProvider(value as ProviderConfig["provider"])}
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
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
                onBlur={(e) => handleBlur("apiKey", e.target.value)}
                className={touched.apiKey && errors.apiKey ? "border-destructive" : ""}
              />
              {touched.apiKey && errors.apiKey && (
                <p className="text-sm text-destructive">{errors.apiKey}</p>
              )}
            </div>

            {/* Base URL (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="baseUrl">
                Base URL <span className="text-xs text-muted-foreground">(Optional)</span>
              </Label>
              <Input
                id="baseUrl"
                type="url"
                placeholder="https://api.openai.com/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                onBlur={(e) => handleBlur("baseUrl", e.target.value)}
                className={touched.baseUrl && errors.baseUrl ? "border-destructive" : ""}
              />
              {touched.baseUrl && errors.baseUrl && (
                <p className="text-sm text-destructive">{errors.baseUrl}</p>
              )}
              <p className="text-xs text-muted-foreground">
                For proxies or custom endpoints
              </p>
            </div>

            {/* Model (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="model">
                Default Model <span className="text-xs text-muted-foreground">(Optional)</span>
              </Label>
              <Input
                id="model"
                placeholder="gpt-4, claude-3-5-sonnet, etc."
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit">Connect</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
