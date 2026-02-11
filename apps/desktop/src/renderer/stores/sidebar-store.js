import { create } from 'zustand'

/**
 * Sidebar UI state that multiple components share.
 *
 * Separated from sidebar context (which provides identity/scoping)
 * because this is ephemeral state, not identity.
 */
export const useSidebarStore = create((set) => ({
  renamingFolderId: null,
  setRenamingFolderId: (id) => set({ renamingFolderId: id }),
}))
