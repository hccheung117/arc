"use client";

import { useEffect } from "react";
import { useChatStore } from "@/lib/chat-store";

/**
 * AppEffects - Handles side effects for app-level settings
 *
 * This component applies theme and font size settings to the DOM.
 * It replaces the functionality previously in AppProvider/AppContext.
 */
export function AppEffects() {
  const theme = useChatStore((state) => state.theme);
  const fontSize = useChatStore((state) => state.fontSize);
  const isHydrated = useChatStore((state) => state.isHydrated);

  // Apply theme to DOM
  useEffect(() => {
    if (!isHydrated) return;

    const root = document.documentElement;
    const effectiveTheme = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;

    root.classList.toggle("dark", effectiveTheme === "dark");
  }, [theme, isHydrated]);

  // Apply font size to DOM
  useEffect(() => {
    if (!isHydrated) return;
    document.documentElement.style.setProperty("--font-size-base", `${fontSize}px`);
  }, [fontSize, isHydrated]);

  // This component doesn't render anything
  return null;
}
