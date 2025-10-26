"use client";

import { useState, useEffect } from "react";
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
import type { ProviderConfig } from "@arc/core/core.js";

interface ProviderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: Partial<ProviderConfig>) => void;
  initialConfig?: ProviderConfig | undefined;
  mode: "add" | "edit";
}

interface FormErrors {
  type?: string;
  name?: string;
  apiKey?: string;
  baseUrl?: string;
}

const PROVIDER_NAMES: Record<ProviderConfig["type"], string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  custom: "Custom",
};

const DEFAULT_BASE_URLS: Record<ProviderConfig["type"], string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  custom: "",
};

export function ProviderFormDialog({
  open,
  onOpenChange,
  onSave,
  initialConfig,
  mode,
}: ProviderFormDialogProps) {
  const [type, setType] = useState<ProviderConfig["type"]>(initialConfig?.type || "openai");
  const [name, setName] = useState(initialConfig?.name || "");
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || "");
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl || "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Reset form when dialog opens or initial config changes
  useEffect(() => {
    if (open) {
      setType(initialConfig?.type || "openai");
      setName(initialConfig?.name || "");
      setApiKey(initialConfig?.apiKey || "");
      setBaseUrl(initialConfig?.baseUrl || DEFAULT_BASE_URLS[initialConfig?.type || "openai"]);
      setErrors({});
      setTouched({});
    }
  }, [open, initialConfig]);

  // Update base URL when provider type changes (only for new providers)
  useEffect(() => {
    if (mode === "add" && !touched.baseUrl) {
      setBaseUrl(DEFAULT_BASE_URLS[type]);
    }
  }, [type, mode, touched.baseUrl]);

  const validateField = (field: string, value: string): string | undefined => {
    switch (field) {
      case "name":
        if (!value.trim()) {
          return "Name is required";
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
    const nameError = validateField("name", name);
    const baseUrlError = validateField("baseUrl", baseUrl);

    if (nameError) newErrors.name = nameError;
    if (baseUrlError) newErrors.baseUrl = baseUrlError;

    // Mark all fields as touched
    setTouched({
      type: true,
      name: true,
      apiKey: true,
      baseUrl: true,
    });

    // Update errors
    setErrors(newErrors);

    // Check if there are any errors
    const hasErrors = Object.keys(newErrors).length > 0;

    if (!hasErrors) {
      // Build config object
      const config: Partial<ProviderConfig> = {
        type,
        name: name.trim() || PROVIDER_NAMES[type],
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
      };

      onSave(config);
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add AI Provider" : "Edit Provider"}</DialogTitle>
          <DialogDescription>
            Configure your AI provider credentials. API keys are stored locally.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Provider Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="type">Provider Type</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as ProviderConfig["type"])}
                disabled={mode === "edit"}
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Provider Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder={PROVIDER_NAMES[type]}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={(e) => handleBlur("name", e.target.value)}
                className={touched.name && errors.name ? "border-destructive" : ""}
              />
              {touched.name && errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
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

            {/* Base URL */}
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input
                id="baseUrl"
                type="url"
                placeholder={DEFAULT_BASE_URLS[type]}
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
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit">{mode === "add" ? "Add Provider" : "Save Changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
