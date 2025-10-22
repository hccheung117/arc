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
import type { ProviderConfig } from "@/lib/chat-store";

interface ProviderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: Partial<ProviderConfig>) => void;
  initialConfig?: ProviderConfig | undefined;
  mode: "add" | "edit";
  preselectedProvider?: ProviderConfig["provider"] | undefined;
}

interface FormErrors {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
}

const PROVIDER_NAMES: Record<ProviderConfig["provider"], string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

export function ProviderFormDialog({
  open,
  onOpenChange,
  onSave,
  initialConfig,
  mode,
  preselectedProvider,
}: ProviderFormDialogProps) {
  const provider = initialConfig?.provider || preselectedProvider || "openai";
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || "");
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl || "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Reset form when dialog opens/closes or initial config changes
  useEffect(() => {
    if (open) {
      setApiKey(initialConfig?.apiKey || "");
      setBaseUrl(initialConfig?.baseUrl || "");
      setErrors({});
      setTouched({});
    }
  }, [open, initialConfig]);

  const validateField = (field: string, value: string): string | undefined => {
    switch (field) {
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
    const baseUrlError = validateField("baseUrl", baseUrl);

    if (baseUrlError) newErrors.baseUrl = baseUrlError;

    // Mark all fields as touched
    setTouched({
      apiKey: true,
      baseUrl: true,
    });

    // Update errors
    setErrors(newErrors);

    // Check if there are any errors
    const hasErrors = Object.keys(newErrors).length > 0;

    if (!hasErrors) {
      const config: Partial<ProviderConfig> = {
        provider,
        ...(apiKey && { apiKey }),  // Only include if provided
        ...(baseUrl && { baseUrl }),
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
          <DialogTitle>{mode === "add" ? "Add Provider" : "Edit Provider"}</DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Configure a new AI provider. Your API keys are stored locally."
              : "Update your provider configuration."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Provider Type (Read-only) */}
            <div className="space-y-2">
              <Label>Provider</Label>
              <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm">
                {PROVIDER_NAMES[provider]}
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="apiKey">
                API Key <span className="text-xs text-muted-foreground">(Optional)</span>
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
              <p className="text-xs text-muted-foreground">
                Some proxies don&apos;t require an API key
              </p>
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
