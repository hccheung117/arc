"use client";

/**
 * ChatAPIProvider - React context for dependency injection of IChatAPI
 *
 * This provider supplies the platform-appropriate ChatAPI implementation
 * (LiveChatAPI for web, DesktopChatAPI for Electron) to all components
 * in the application.
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { useApp } from "../app-context";
import type { IChatAPI } from "./chat-api.interface";
import { getChatAPIInstance } from "./chat-api-factory";

// ============================================================================
// Context Definition
// ============================================================================

interface ChatAPIContextValue {
  api: IChatAPI;
}

const ChatAPIContext = createContext<ChatAPIContextValue | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

export function ChatAPIProvider({ children }: { children: React.ReactNode }) {
  const { isHydrated } = useApp();
  const [api, setApi] = useState<IChatAPI | null>(null);

  // Load platform-appropriate API implementation
  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    let mounted = true;

    const initApi = async () => {
      try {
        const apiInstance = await getChatAPIInstance();
        if (mounted) {
          setApi(apiInstance);
          if (apiInstance.ready) {
            await apiInstance.ready();
          }
        }
      } catch (error) {
        console.error("Failed to initialize ChatAPI:", error);
      }
    };

    void initApi();

    return () => {
      mounted = false;
    };
  }, [isHydrated]);

  // Don't render until API is ready
  if (!isHydrated || !api) {
    return null;
  }

  const value: ChatAPIContextValue = {
    api,
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
 * @returns The active IChatAPI implementation
 * @throws Error if used outside of ChatAPIProvider
 */
export function useChatAPI(): ChatAPIContextValue {
  const context = useContext(ChatAPIContext);

  if (context === undefined) {
    throw new Error("useChatAPI must be used within a ChatAPIProvider");
  }

  return context;
}
