"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
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
import type { ProviderConfig } from "@arc/core/core.js";

// Payload the dialog will emit on save. In add mode we send a sentinel 'auto'
// type to allow the Core to auto-detect the concrete provider.
type ProviderSavePayload =
  | { type: "auto"; name: string; apiKey: string; baseUrl: string }
  | Partial<ProviderConfig>;

interface ProviderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: ProviderSavePayload) => void;
  initialConfig?: ProviderConfig | undefined;
  mode: "add" | "edit";
  isSaving?: boolean;
}

interface FormErrors {
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

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

export function ProviderFormDialog({
  open,
  onOpenChange,
  onSave,
  initialConfig,
  mode,
  isSaving = false,
}: ProviderFormDialogProps) {
  const [name, setName] = useState(initialConfig?.name || "");
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || "");
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl || "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Reset form when dialog opens or initial config changes
  useEffect(() => {
    if (open) {
      setName(initialConfig?.name || "");
      setApiKey(initialConfig?.apiKey || "");
      // In add mode, leave baseUrl empty to avoid appending when typing in tests; show default via placeholder only.
      setBaseUrl(initialConfig?.baseUrl || (mode === "edit" ? DEFAULT_BASE_URL : ""));
      setErrors({});
      setTouched({});
    }
  }, [open, initialConfig, mode]);

  const validateField = (field: string, value: string): string | undefined => {
    switch (field) {
      case "name":
        // Name is optional in add mode (we generate a default). Required only in edit mode.
        if (mode === "edit" && !value.trim()) return "Name is required";
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
      name: true,
      apiKey: true,
      baseUrl: true,
    });

    // Update errors
    setErrors(newErrors);

    // Check if there are any errors
    const hasErrors = Object.keys(newErrors).length > 0;

    if (!hasErrors) {
      const trimmedName = name.trim();
      const payloadName = trimmedName || "AI Provider";
      const payloadBase = {
        name: payloadName,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
      };

      if (mode === "add") {
        onSave({ type: "auto", ...payloadBase });
      } else {
        onSave(payloadBase);
      }
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
            {mode === "add"
              ? "Enter your API credentials. The provider type will be detected automatically."
              : "Update your provider credentials. API keys are stored locally."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Provider Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                type="text"
                placeholder={mode === "edit" && initialConfig ? PROVIDER_NAMES[initialConfig.type] : "My AI Provider"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={(e) => handleBlur("name", e.target.value)}
                className={touched.name && errors.name ? "border-destructive" : ""}
              />
              {touched.name && errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
              {mode === "add" && (
                <p className="text-xs text-muted-foreground">
                  A name will be generated based on the detected provider type
                </p>
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
              <Label htmlFor="baseUrl">Base URL (optional)</Label>
              <Input
                id="baseUrl"
                type="url"
                placeholder={DEFAULT_BASE_URL}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                onBlur={(e) => handleBlur("baseUrl", e.target.value)}
                className={touched.baseUrl && errors.baseUrl ? "border-destructive" : ""}
              />
              {touched.baseUrl && errors.baseUrl && (
                <p className="text-sm text-destructive">{errors.baseUrl}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Leave empty to use the provider&apos;s default endpoint, or specify a custom URL for proxies
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "add" ? "Add Provider" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
