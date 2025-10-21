"use client";

/**
 * ElectronIntegration - Desktop app specific integration components
 *
 * Handles Electron-specific features like update dialogs
 * Only renders when running in Electron
 */

import { useUpdateDialog } from "@/lib/hooks/use-update-dialog";
import { UpdateDialog } from "./UpdateDialog";

export function ElectronIntegration() {
  const { open, setOpen } = useUpdateDialog();

  // Don't render anything if not in Electron
  if (typeof window === "undefined" || !window.electron) {
    return null;
  }

  return (
    <>
      <UpdateDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
