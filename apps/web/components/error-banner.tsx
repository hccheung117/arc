"use client";

import { AlertTriangle, Key, Clock, X } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { useChatStore } from "@/lib/chat-store";

export function ErrorBanner() {
  const { lastError, clearError } = useChatStore();

  if (!lastError) return null;

  // Choose icon based on error code
  const getIcon = () => {
    if (lastError.code === "invalid_api_key" || lastError.code === "expired_api_key") {
      return <Key className="h-4 w-4" />;
    }
    if (lastError.code === "rate_limit_exceeded" || lastError.code === "timeout") {
      return <Clock className="h-4 w-4" />;
    }
    return <AlertTriangle className="h-4 w-4" />;
  };

  return (
    <Alert variant="destructive" className="mb-4">
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{getIcon()}</div>
        <div className="flex-1">
          <AlertDescription>{lastError.userMessage}</AlertDescription>
          {lastError.isRetryable && (
            <p className="text-xs mt-1 opacity-80">
              You can try again after fixing the issue.
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 -mr-2"
          onClick={clearError}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
