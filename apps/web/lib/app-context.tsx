"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

// Types
export type Theme = "light" | "dark" | "system";

export interface ProviderConfig {
  provider: "openai" | "anthropic" | "google" | "custom";
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

interface AppState {
  theme: Theme;
  fontSize: number; // 12-20px
  providerConfig: ProviderConfig | null;
  hasCompletedFirstRun: boolean;
}

interface AppContextValue extends AppState {
  setTheme: (theme: Theme) => void;
  setFontSize: (size: number) => void;
  setProviderConfig: (config: ProviderConfig | null) => void;
  completeFirstRun: () => void;
  isHydrated: boolean;
}

// Default values
const DEFAULT_STATE: AppState = {
  theme: "system",
  fontSize: 16,
  providerConfig: null,
  hasCompletedFirstRun: false,
};

const STORAGE_KEY = "arc-app-state";

// localStorage utilities
const loadFromStorage = (): Partial<AppState> => {
  if (typeof window === "undefined") return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error("Failed to load app state from localStorage:", error);
    return {};
  }
};

const saveToStorage = (state: AppState): void => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to save app state to localStorage:", error);
  }
};

// Create context
const AppContext = createContext<AppContextValue | undefined>(undefined);

// Provider component
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [state, setState] = useState<AppState>(DEFAULT_STATE);

  // Hydrate from localStorage on mount (client-side only)
  useEffect(() => {
    const storedState = loadFromStorage();
    setState((prev) => ({ ...prev, ...storedState }));
    setIsHydrated(true);
  }, []);

  // Persist to localStorage whenever state changes
  useEffect(() => {
    if (isHydrated) {
      saveToStorage(state);
    }
  }, [state, isHydrated]);

  // Apply theme to DOM
  useEffect(() => {
    if (!isHydrated) return;

    const root = document.documentElement;
    const effectiveTheme = state.theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : state.theme;

    root.classList.toggle("dark", effectiveTheme === "dark");
  }, [state.theme, isHydrated]);

  // Apply font size to DOM
  useEffect(() => {
    if (!isHydrated) return;
    document.documentElement.style.setProperty("--font-size-base", `${state.fontSize}px`);
  }, [state.fontSize, isHydrated]);

  // Update actions
  const setTheme = useCallback((theme: Theme) => {
    setState((prev) => ({ ...prev, theme }));
  }, []);

  const setFontSize = useCallback((fontSize: number) => {
    setState((prev) => ({ ...prev, fontSize }));
  }, []);

  const setProviderConfig = useCallback((providerConfig: ProviderConfig | null) => {
    setState((prev) => ({ ...prev, providerConfig }));
  }, []);

  const completeFirstRun = useCallback(() => {
    setState((prev) => ({ ...prev, hasCompletedFirstRun: true }));
  }, []);

  const value: AppContextValue = {
    ...state,
    setTheme,
    setFontSize,
    setProviderConfig,
    completeFirstRun,
    isHydrated,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Custom hook to use the context
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
