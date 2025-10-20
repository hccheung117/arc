"use client";

/**
 * DevPanel - Development panel for toggling between Mock and Live API modes
 *
 * This floating panel appears in the bottom-right corner and allows developers
 * to switch between Mock (local Zustand) and Live (HTTP backend) implementations
 * at runtime without restarting the application.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApp } from "@/lib/app-context";
import { Database, Globe, Info } from "lucide-react";

export function DevPanel() {
  const { apiMode, setApiMode } = useApp();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const isMockMode = apiMode === "mock";

  const handleToggle = () => {
    const newMode = isMockMode ? "live" : "mock";
    setApiMode(newMode);
  };

  return (
    <>
      {/* Floating badge in bottom-right corner */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
        {/* Info button */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDetailsOpen(true)}
          className="size-8 rounded-full shadow-lg bg-background/95 backdrop-blur-sm"
          aria-label="Show API mode details"
        >
          <Info className="size-3.5" />
        </Button>

        {/* Mode indicator & toggle button */}
        <Button
          variant={isMockMode ? "default" : "secondary"}
          onClick={handleToggle}
          className="shadow-lg bg-background/95 backdrop-blur-sm border text-sm font-medium px-3 py-1.5 h-8"
          aria-label={`Switch to ${isMockMode ? "Live" : "Mock"} mode`}
        >
          {isMockMode ? (
            <>
              <Database className="size-3.5 mr-1.5" />
              Mock
            </>
          ) : (
            <>
              <Globe className="size-3.5 mr-1.5" />
              Live
            </>
          )}
        </Button>
      </div>

      {/* Details dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>API Mode: {isMockMode ? "Mock" : "Live"}</DialogTitle>
            <DialogDescription>
              Arc can run in two different modes for development and testing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Mock Mode Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Database className="size-4 text-primary" />
                <h3 className="font-semibold">Mock Mode (Current)</h3>
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                All data is stored locally in browser memory using Zustand state management.
                Perfect for offline development, testing UI flows, and demo purposes.
                No backend server required.
              </p>
            </div>

            {/* Live Mode Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-amber-600" />
                <h3 className="font-semibold">Live Mode (Coming Soon)</h3>
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                Data is persisted to a backend server via HTTP API calls.
                Enables cross-device sync, cloud storage, and multi-user features.
                Currently shows &quot;not implemented&quot; errors for testing purposes.
              </p>
            </div>

            {/* Current Status */}
            <div className="mt-6 p-4 bg-secondary/50 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Current Mode</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isMockMode ? "Local data storage" : "Backend API (stub)"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggle}
                >
                  Switch to {isMockMode ? "Live" : "Mock"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
