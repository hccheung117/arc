"use client";

/**
 * CoreProvider - React context for dependency injection of the Core instance
 *
 * This provider initializes the platform-appropriate Core implementation
 * (Browser for web, Electron for desktop) and provides it to all components
 * in the application via React Context.
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { createCore, type Core } from "@arc/core/core.js";

// ============================================================================
// Platform Detection
// ============================================================================

/**
 * Detect if we're running in Electron
 */
function isElectron(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.electron !== "undefined"
  );
}

// ============================================================================
// Context Definition
// ============================================================================

interface CoreContextValue {
  core: Core;
  isReady: boolean;
}

const CoreContext = createContext<CoreContextValue | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

export function CoreProvider({ children, value }: { children: React.ReactNode; value?: Core }) {
  const [core, setCore] = useState<Core | null>(value ?? null);
  const [isReady, setIsReady] = useState(!!value);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    // If a Core instance is provided (e.g., in tests), use it and skip initialization
    if (value) {
      setCore(value);
      setIsReady(true);
      return () => {
        mounted = false;
      };
    }

    const initCore = async () => {
      try {
        // Detect platform (browser or electron)
        const isElectronEnv = isElectron();

        // Create core with the appropriate platform type
        // Core handles platform creation internally
        const coreInstance = isElectronEnv
          ? await createCore({ platform: "electron" })
          : await createCore({ platform: "browser" });

        if (mounted) {
          setCore(coreInstance);
          setIsReady(true);
        }
      } catch (error) {
        console.error("Failed to initialize Core:", error);
        if (mounted) {
          setError(error instanceof Error ? error : new Error("Unknown error"));
        }
      }
    };

    void initCore();

    return () => {
      mounted = false;
      // Cleanup core on unmount only for internally created cores
      if (!value && core) {
        core.close().catch((error) => {
          console.error("Failed to close core:", error);
        });
      }
    };
  }, [value]);

  // Error state
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-4">
          <h1 className="text-2xl font-semibold text-destructive">
            Failed to Initialize
          </h1>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (!isReady || !core) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  const contextValue: CoreContextValue = {
    core,
    isReady,
  };

  return (
    <CoreContext.Provider value={contextValue}>
      {children}
    </CoreContext.Provider>
  );
}

// ============================================================================
// Custom Hook
// ============================================================================

/**
 * Hook to access the Core from any component
 * @returns The active Core instance
 * @throws Error if used outside of CoreProvider
 */
export function useCore(): Core {
  const context = useContext(CoreContext);

  if (context === undefined) {
    throw new Error("useCore must be used within a CoreProvider");
  }

  return context.core;
}
