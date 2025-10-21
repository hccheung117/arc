"use client";

/**
 * ChatAPIProvider - React context for dependency injection of IChatAPI
 *
 * This provider supplies the active IChatAPI implementation (Mock or Live/Desktop)
 * to all components in the application. The implementation is determined by
 * the apiMode setting in AppContext and automatically adapts to the platform
 * (web or Electron desktop).
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useApp } from "../app-context";
import type { IChatAPI } from "./chat-api.interface";
import { MockChatAPI } from "./mock-chat-api";
import { getChatAPIInstance, isElectron } from "./index";

// ============================================================================
// Context Definition
// ============================================================================

interface ChatAPIContextValue {
  api: IChatAPI;
  mode: "mock" | "live";
}

const ChatAPIContext = createContext<ChatAPIContextValue | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

export function ChatAPIProvider({ children }: { children: React.ReactNode }) {
  const { apiMode, isHydrated } = useApp();
  const [liveApi, setLiveApi] = useState<IChatAPI | null>(null);

  // Create mock API instance (memoized to avoid recreating on every render)
  const mockApi = useMemo(() => new MockChatAPI(), []);

  // Load platform-appropriate live API implementation
  useEffect(() => {
    if (!isHydrated || apiMode !== "live") {
      return;
    }

    let mounted = true;

    const initLiveApi = async () => {
      try {
        const api = await getChatAPIInstance();
        if (mounted) {
          setLiveApi(api);
          if (api.ready) {
            await api.ready();
          }
        }
      } catch (error) {
        console.error("Failed to initialize ChatAPI:", error);
      }
    };

    void initLiveApi();

    return () => {
      mounted = false;
    };
  }, [apiMode, isHydrated]);

  // Select the active API based on apiMode
  const api = apiMode === "live" ? liveApi : mockApi;

  // Don't render if we're in live mode but the API isn't ready yet
  if (!isHydrated || (apiMode === "live" && !liveApi)) {
    return null;
  }

  const value: ChatAPIContextValue = {
    api: api!,
    mode: apiMode || "mock",
  };

  return (
    <ChatAPIContext.Provider value={value}>
      {children}
    </ChatAPIContext.Provider>
  );
}

// ============================================================================
// Custom Hook
// ============================================================================

/**
 * Hook to access the ChatAPI from any component
 * @returns The active IChatAPI implementation and current mode
 * @throws Error if used outside of ChatAPIProvider
 */
export function useChatAPI(): ChatAPIContextValue {
  const context = useContext(ChatAPIContext);

  if (context === undefined) {
    throw new Error("useChatAPI must be used within a ChatAPIProvider");
  }

  return context;
}
