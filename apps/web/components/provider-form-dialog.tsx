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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";
import type { ProviderConfig } from "@/lib/chat-store";
import { useProviderDetection } from "@/lib/hooks/use-provider-detection";
import { ProviderChooser } from "./provider-chooser";
import { normalizeBaseUrl } from "@/lib/utils/normalize-base-url";

interface ProviderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: Partial<ProviderConfig>, originalBaseUrl?: string) => void;
  initialConfig?: ProviderConfig | undefined;
  mode: "add" | "edit";
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
}: ProviderFormDialogProps) {
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || "");
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl || "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Manual provider selection (only shown after detection failure)
  const [manualMode, setManualMode] = useState(mode === "edit");
  const [manualProvider, setManualProvider] = useState<ProviderConfig["provider"]>(
    initialConfig?.provider || "openai"
  );

  // Provider chooser state (for multiple detections)
  const [showChooser, setShowChooser] = useState(false);
  const [detectedProviders, setDetectedProviders] = useState<ProviderConfig["provider"][]>([]);
  const [normalizedUrls, setNormalizedUrls] = useState<Record<string, string | undefined>>({});

  // Provider detection hook
  const { isDetecting, results, successfulProviders, detect, cancel } = useProviderDetection();

  // Reset form when dialog opens/closes or initial config changes
  useEffect(() => {
    if (open) {
      setApiKey(initialConfig?.apiKey || "");
      setBaseUrl(initialConfig?.baseUrl || "");
      setErrors({});
      setTouched({});
      setManualMode(mode === "edit");
      setManualProvider(initialConfig?.provider || "openai");
      setShowChooser(false);
      setDetectedProviders([]);
      setNormalizedUrls({});
    } else {
      // Cancel detection when dialog closes
      cancel();
    }
  }, [open, initialConfig, mode, cancel]);

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

  const handleSubmit = async (e: React.FormEvent) => {
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

    if (hasErrors) {
      return;
    }

    // In edit mode or manual mode, save directly without detection
    if (mode === "edit" || manualMode) {
      // Normalize the base URL before saving
      const normalizedUrl = baseUrl ? normalizeBaseUrl(baseUrl) : undefined;

      const config: Partial<ProviderConfig> = {
        provider: manualProvider,
        ...(apiKey && { apiKey }),  // Only include if provided
        ...(normalizedUrl && { baseUrl: normalizedUrl }),
      };

      onSave(config, baseUrl || undefined);
      onOpenChange(false);
      return;
    }

    // In add mode, run detection and handle results
    await detect(apiKey, baseUrl);

    // Note: Results will be processed in the effect below
  };

  // Handle detection results
  useEffect(() => {
    if (!isDetecting && results.length > 0) {
      if (successfulProviders.length === 0) {
        // No successes - show errors and enable manual mode
        const errorMessages = results
          .filter((r) => !r.success && r.error)
          .map((r) => `${PROVIDER_NAMES[r.provider]}: ${r.error}`)
          .join("; ");

        setErrors({
          provider: errorMessages || "All provider detections failed. Please check your credentials.",
        });
        setManualMode(true);
      } else if (successfulProviders.length === 1) {
        // Single success - auto-select and save with normalized URL
        const provider = successfulProviders[0]!;
        const result = results.find((r) => r.provider === provider && r.success);
        const normalizedUrl = result?.normalizedBaseUrl;

        const config: Partial<ProviderConfig> = {
          provider,
          ...(apiKey && { apiKey }),
          ...(normalizedUrl && { baseUrl: normalizedUrl }),
        };

        onSave(config, baseUrl || undefined);
        onOpenChange(false);
      } else {
        // Multiple successes - build normalized URL map and show chooser
        const urlMap: Record<string, string | undefined> = {};
        results
          .filter((r) => r.success)
          .forEach((r) => {
            urlMap[r.provider] = r.normalizedBaseUrl;
          });

        setNormalizedUrls(urlMap);
        setDetectedProviders(successfulProviders);
        setShowChooser(true);
      }
    }
  }, [isDetecting, results, successfulProviders, apiKey, baseUrl, onSave, onOpenChange]);

  const handleProviderSelect = (provider: ProviderConfig["provider"]) => {
    // Use the normalized URL from detection results
    const normalizedUrl = normalizedUrls[provider];

    const config: Partial<ProviderConfig> = {
      provider,
      ...(apiKey && { apiKey }),
      ...(normalizedUrl && { baseUrl: normalizedUrl }),
    };

    onSave(config, baseUrl || undefined);
    onOpenChange(false);
  };

  const handleCancel = () => {
    cancel();
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{mode === "add" ? "Add Provider" : "Edit Provider"}</DialogTitle>
            <DialogDescription>
              {mode === "add"
                ? "Enter your API credentials. We'll automatically detect which provider works with your key."
                : "Update your provider configuration."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Detection error alert */}
              {errors.provider && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold mb-1">Auto-detection failed</div>
                    <div className="text-sm">{errors.provider}</div>
                    <div className="text-sm mt-2">
                      Please select a provider manually below and try again.
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Manual provider selection (only shown in edit mode or after detection failure) */}
              {manualMode && (
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  {mode === "edit" ? (
                    <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm">
                      {PROVIDER_NAMES[manualProvider]}
                    </div>
                  ) : (
                    <Select
                      value={manualProvider}
                      onValueChange={(value) => setManualProvider(value as ProviderConfig["provider"])}
                    >
                      <SelectTrigger id="provider">
                        <SelectValue placeholder="Select a provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="google">Google</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

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
                  disabled={isDetecting}
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
                  disabled={isDetecting}
                />
                {touched.baseUrl && errors.baseUrl && (
                  <p className="text-sm text-destructive">{errors.baseUrl}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  For proxies or custom endpoints
                </p>
              </div>

              {/* Detection status */}
              {isDetecting && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Detecting compatible providers...</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel} disabled={isDetecting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isDetecting}>
                {isDetecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Detecting...
                  </>
                ) : (
                  mode === "add" ? "Add Provider" : "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Provider chooser for multiple detections */}
      <ProviderChooser
        open={showChooser}
        onOpenChange={setShowChooser}
        providers={detectedProviders}
        baseUrl={baseUrl}
        onSelect={handleProviderSelect}
      />
    </>
  );
}
