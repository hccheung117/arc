import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Theme options
 */
export type Theme = "light" | "dark" | "system";

/**
 * UI-only transient state
 *
 * This store contains ONLY UI-specific state that doesn't belong in the Core.
 * All business logic (chats, messages, providers) is managed by @arc/core.
 */
interface UIState {
  // App settings
  theme: Theme;
  fontSize: number;
  isHydrated: boolean;

  // UI transient state
  sidebarOpen: boolean;

  // Actions
  setTheme: (theme: Theme) => void;
  setFontSize: (fontSize: number) => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial state
      theme: "system",
      fontSize: 16,
      isHydrated: false,
      sidebarOpen: false,

      // Actions
      setTheme: (theme: Theme) => set({ theme }),
      setFontSize: (fontSize: number) => set({ fontSize }),
      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
    }),
    {
      name: "arc-ui-storage",
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        // Don't persist sidebarOpen, isHydrated
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            state.isHydrated = true;
          }
        };
      },
    }
  )
);
