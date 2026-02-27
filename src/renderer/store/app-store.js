import { create } from "zustand"
import { generateId } from "ai"
import { resolveMode } from "@/lib/composer-modes"

const defaultWorkbench = () => ({
  modelId: null,
  composerDrafts: {},
  composerMode: { mode: "chat" },
  branchLeaf: null,
  scrollAnchor: null,
})

const initialDraftId = generateId()

export const useAppStore = create((set) => ({
  activeSessionId: initialDraftId,
  draftSessionId: initialDraftId,
  workbenches: { [initialDraftId]: defaultWorkbench() },

  session: {
    activate: (id) => set((s) => ({
      activeSessionId: id,
      workbenches: s.workbenches[id]
        ? s.workbenches
        : { ...s.workbenches, [id]: defaultWorkbench() },
    })),

    new: () => set((s) => {
      if (s.activeSessionId !== s.draftSessionId) {
        return { activeSessionId: s.draftSessionId }
      }
      const id = generateId()
      return {
        activeSessionId: id,
        draftSessionId: id,
        workbenches: { ...s.workbenches, [id]: defaultWorkbench() },
      }
    }),

    // Promotes the current draft to a real session and prepares a fresh draft.
    // Submit protocol: composer.setDraft(mode, "") → session.retireDraft()
    retireDraft: () => set((s) => {
      if (s.activeSessionId !== s.draftSessionId) return s
      const id = generateId()
      return {
        draftSessionId: id,
        workbenches: { ...s.workbenches, [id]: defaultWorkbench() },
      }
    }),
  },

  composer: {
    setMode: (mode, overrides) => set((s) => {
      const wb = s.workbenches[s.activeSessionId]
      return {
        workbenches: {
          ...s.workbenches,
          [s.activeSessionId]: {
            ...wb,
            composerMode: { mode, ...overrides },
          },
        },
      }
    }),

    // Submit protocol: composer.setDraft(mode, "") → session.retireDraft()
    setDraft: (mode, value) => set((s) => {
      const wb = s.workbenches[s.activeSessionId]
      return {
        workbenches: {
          ...s.workbenches,
          [s.activeSessionId]: {
            ...wb,
            composerDrafts: { ...wb.composerDrafts, [mode]: value },
          },
        },
      }
    }),
  },

  workbench: {
    update: (patch) => set((s) => ({
      workbenches: {
        ...s.workbenches,
        [s.activeSessionId]: { ...s.workbenches[s.activeSessionId], ...patch },
      },
    })),
  },
}))

export const act = useAppStore.getState

export const useComposerMode = () => {
  const composerMode = useAppStore((s) => s.workbenches[s.activeSessionId]?.composerMode)
  const { mode, ...overrides } = composerMode ?? { mode: "chat" }
  return { mode, config: resolveMode(mode, overrides) }
}

export const useActiveWorkbench = () =>
  useAppStore((s) => s.workbenches[s.activeSessionId])
