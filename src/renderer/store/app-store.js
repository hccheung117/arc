import { create } from "zustand"
import { sessionId } from "@shared/ids.js"

// [SSOT] activeSkill removed — editor document is single source of truth for mentions.
// External actors use composerActions.insertMention() [CMD-CHANNEL].
// Main detects activeSkill from message text [DETECT-MAIN].
const defaultWorkbench = () => ({
  providerId: null,
  modelId: null,
  promptRef: null,
  branchLeaf: null,
  scrollAnchor: null,
})

const initialDraftId = sessionId()

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
      const id = sessionId()
      return {
        activeSessionId: id,
        draftSessionId: id,
        workbenches: { ...s.workbenches, [id]: defaultWorkbench() },
      }
    }),

    // Promotes the current draft to a real session and prepares a fresh draft.
    commitDraft: () => set((s) => {
      if (s.activeSessionId !== s.draftSessionId) return s
      const id = sessionId()
      return {
        draftSessionId: id,
        workbenches: { ...s.workbenches, [id]: defaultWorkbench() },
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

export const useActiveWorkbench = () =>
  useAppStore((s) => s.workbenches[s.activeSessionId])
