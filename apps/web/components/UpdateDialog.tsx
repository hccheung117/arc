"use client";

/**
 * UpdateDialog - Desktop app update checker
 *
 * Shows current version, latest version, release notes, and download link
 * when updates are available. Only visible in Electron desktop app.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription } from "./ui/alert";

interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string | null;
  releaseNotes: string | null;
  downloadUrl: string | null;
  publishedAt?: string;
  error?: string;
}

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateDialog({ open, onOpenChange }: UpdateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  // Check for updates when dialog opens
  useEffect(() => {
    if (!open) {
      return;
    }

    const checkForUpdates = async () => {
      setLoading(true);
      setUpdateInfo(null);

      try {
        // Check if we're in Electron
        if (!window.electron) {
          throw new Error("Not running in Electron");
        }

        const info = await window.electron.updates.check();
        setUpdateInfo(info);
      } catch (error) {
        console.error("Failed to check for updates:", error);
        setUpdateInfo({
          hasUpdate: false,
          currentVersion: "Unknown",
          latestVersion: null,
          releaseNotes: null,
          downloadUrl: null,
          error: error instanceof Error ? error.message : "Failed to check for updates",
        });
      } finally {
        setLoading(false);
      }
    };

    void checkForUpdates();
  }, [open]);

  const handleDownload = () => {
    if (updateInfo?.downloadUrl) {
      // Open download URL in external browser
      if (window.electron) {
        // In a real implementation, you might want to add an IPC handler to open URLs in default browser
        window.open(updateInfo.downloadUrl, "_blank");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Software Update</DialogTitle>
          <DialogDescription>
            Check for the latest version of Arc
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {!loading && updateInfo?.error && (
            <Alert variant="destructive">
              <AlertDescription>{updateInfo.error}</AlertDescription>
            </Alert>
          )}

          {!loading && updateInfo && !updateInfo.error && (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-muted-foreground">
                    Current Version
                  </div>
                  <div className="font-mono">{updateInfo.currentVersion}</div>
                </div>
                <div>
                  <div className="font-medium text-muted-foreground">
                    Latest Version
                  </div>
                  <div className="font-mono">
                    {updateInfo.latestVersion || "Unknown"}
                  </div>
                </div>
              </div>

              {updateInfo.hasUpdate && updateInfo.releaseNotes && (
                <div className="space-y-2">
                  <div className="font-medium text-sm">Release Notes</div>
                  <div className="rounded-md border bg-muted/50 p-3 text-sm max-h-60 overflow-y-auto">
                    <pre className="whitespace-pre-wrap font-sans">
                      {updateInfo.releaseNotes}
                    </pre>
                  </div>
                </div>
              )}

              {updateInfo.hasUpdate && updateInfo.publishedAt && (
                <div className="text-xs text-muted-foreground">
                  Released on{" "}
                  {new Date(updateInfo.publishedAt).toLocaleDateString()}
                </div>
              )}

              {!updateInfo.hasUpdate && (
                <Alert>
                  <AlertDescription>
                    You&apos;re running the latest version of Arc.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          {updateInfo?.hasUpdate && updateInfo.downloadUrl && (
            <Button onClick={handleDownload} variant="default">
              Download Update
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
