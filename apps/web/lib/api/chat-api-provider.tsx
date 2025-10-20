"use client";

/**
 * ChatAPIProvider - React context for dependency injection of IChatAPI
 *
 * This provider supplies the active IChatAPI implementation (Mock or Live)
 * to all components in the application. The implementation is determined by
 * the apiMode setting in AppContext.
 */

import React, { createContext, useContext, useMemo } from "react";
import { useApp } from "../app-context";
import type { IChatAPI } from "./chat-api.interface";
import { MockChatAPI } from "./mock-chat-api";
import { LiveChatAPI } from "./live-chat-api";

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

  // Create API instances (memoized to avoid recreating on every render)
  const mockApi = useMemo(() => new MockChatAPI(), []);
  const liveApi = useMemo(() => new LiveChatAPI(), []);

  // Select the active API based on apiMode
  const api = apiMode === "live" ? liveApi : mockApi;

  const value: ChatAPIContextValue = {
    api,
    mode: apiMode || "mock",
  };

  // Don't render children until hydrated to avoid mismatches
  if (!isHydrated) {
    return null;
  }

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
