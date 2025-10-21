"use client";

/**
 * Hook to manage the update dialog state
 *
 * Listens for IPC events from the Electron main process to show the dialog
 */

import { useEffect, useState } from "react";

export function useUpdateDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Only set up listener if we're in Electron
    if (typeof window === "undefined" || !window.electron) {
      return;
    }

    // Listen for "show-update-dialog" event from main process
    const handleShowUpdateDialog = () => {
      setOpen(true);
    };

    window.electron.on("show-update-dialog", handleShowUpdateDialog);

    return () => {
      window.electron?.off("show-update-dialog", handleShowUpdateDialog);
    };
  }, []);

  return {
    open,
    setOpen,
  };
}
