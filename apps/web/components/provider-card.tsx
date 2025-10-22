"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProviderConfig } from "@/lib/chat-store";
import { CheckCircle2, XCircle, Edit, Trash2 } from "lucide-react";

interface ProviderCardProps {
  config: ProviderConfig;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  onToggle: () => void;
  isTesting?: boolean;
}

const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  custom: "Custom",
};

export function ProviderCard({
  config,
  onEdit,
  onDelete,
  onTest,
  onToggle,
  isTesting = false,
}: ProviderCardProps) {
  const providerName = PROVIDER_NAMES[config.provider] || config.provider;
  const maskedApiKey = `${config.apiKey.substring(0, 7)}...${config.apiKey.substring(config.apiKey.length - 4)}`;

  return (
    <Card className={!config.enabled ? "opacity-60" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            {providerName}
            {config.enabled ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Enabled
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="h-3 w-3 mr-1" />
                Disabled
              </Badge>
            )}
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
          <Button variant="outline" size="sm" onClick={onTest} disabled={isTesting || !config.enabled}>
            {isTesting ? "Testing..." : "Test Connection"}
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={onToggle}>
            {config.enabled ? "Disable" : "Enable"}
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
