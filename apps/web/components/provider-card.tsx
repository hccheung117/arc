"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProviderConfig } from "@/lib/chat-store";
import { Edit, Trash2 } from "lucide-react";

interface ProviderCardProps {
  config: ProviderConfig;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  isTesting?: boolean;
}

const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

// Brand color gradients for each provider
const PROVIDER_GRADIENTS: Record<string, string> = {
  openai: "linear-gradient(135deg, rgba(16, 163, 127, 0.08) 0%, rgba(16, 163, 127, 0.02) 100%)",
  anthropic: "linear-gradient(135deg, rgba(212, 129, 107, 0.08) 0%, rgba(212, 129, 107, 0.02) 100%)",
  google: "linear-gradient(135deg, rgba(66, 133, 244, 0.08) 0%, rgba(66, 133, 244, 0.02) 100%)",
};

export function ProviderCard({
  config,
  onEdit,
  onDelete,
  onTest,
  isTesting = false,
}: ProviderCardProps) {
  const providerName = PROVIDER_NAMES[config.provider] || config.provider;
  const maskedApiKey = config.apiKey
    ? `${config.apiKey.substring(0, 7)}...${config.apiKey.substring(config.apiKey.length - 4)}`
    : "Not set";

  // Get brand gradient for this provider
  const backgroundImage = PROVIDER_GRADIENTS[config.provider];

  return (
    <Card style={backgroundImage ? { backgroundImage } : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {providerName}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">API Key:</span>{" "}
            <span className="font-mono">{maskedApiKey}</span>
          </div>
          {config.baseUrl && (
            <div>
              <span className="text-muted-foreground">Base URL:</span> {config.baseUrl}
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onTest} disabled={isTesting}>
            {isTesting ? "Testing..." : "Test Connection"}
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
