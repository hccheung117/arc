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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";
import type { ProviderConfig } from "@/lib/chat-store";

const PROVIDER_NAMES: Record<ProviderConfig["provider"], string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

const PROVIDER_DESCRIPTIONS: Record<ProviderConfig["provider"], string> = {
  openai: "GPT models, DALL-E, Whisper, and more",
  anthropic: "Claude models with advanced reasoning",
  google: "Gemini models with multimodal capabilities",
};

interface ProviderChooserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: ProviderConfig["provider"][];
  baseUrl?: string;
  onSelect: (provider: ProviderConfig["provider"]) => void;
}

/**
 * Provider chooser dialog
 *
 * Shown when multiple providers are detected as compatible with the
 * given API key and base URL. Allows the user to select which provider
 * to use.
 */
export function ProviderChooser({
  open,
  onOpenChange,
  providers,
  baseUrl,
  onSelect,
}: ProviderChooserProps) {
  // Auto-select based on baseUrl hints, or default to first provider
  const getDefaultProvider = (): ProviderConfig["provider"] => {
    if (baseUrl) {
      const url = baseUrl.toLowerCase();
      if (url.includes("openai")) return "openai";
      if (url.includes("anthropic") || url.includes("claude")) return "anthropic";
      if (url.includes("google") || url.includes("gemini")) return "google";
    }
    return providers[0] || "openai";
  };

  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig["provider"]>(
    getDefaultProvider()
  );

  const handleSubmit = () => {
    onSelect(selectedProvider);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Multiple Providers Detected</DialogTitle>
          <DialogDescription>
            Your credentials work with multiple AI providers. Please select which one you&apos;d like to use.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as ProviderConfig["provider"])}>
            <div className="space-y-3">
              {providers.map((provider) => (
                <div key={provider}>
                  <RadioGroupItem
                    value={provider}
                    id={provider}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={provider}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-border bg-background p-4 hover:bg-accent peer-data-[state=checked]:border-primary"
                  >
                    <CheckCircle2 className="h-5 w-5 mt-0.5 text-primary opacity-0 peer-data-[state=checked]:opacity-100" />
                    <div className="flex-1">
                      <div className="font-semibold">{PROVIDER_NAMES[provider]}</div>
                      <div className="text-sm text-muted-foreground">
                        {PROVIDER_DESCRIPTIONS[provider]}
                      </div>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>

          {baseUrl && (
            <p className="text-xs text-muted-foreground mt-4">
              <strong>Tip:</strong> Your base URL ({baseUrl}) suggests this might be a multi-provider proxy.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Select Provider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
