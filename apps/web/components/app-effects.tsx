"use client";

import { useEffect } from "react";
import { useUIStore } from "@/lib/ui-store";

/**
 * AppEffects - Handles side effects for app-level settings
 *
 * This component applies theme and font size settings to the DOM.
 */
export function AppEffects() {
  const theme = useUIStore((state) => state.theme);
  const fontSize = useUIStore((state) => state.fontSize);
  const isHydrated = useUIStore((state) => state.isHydrated);

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
