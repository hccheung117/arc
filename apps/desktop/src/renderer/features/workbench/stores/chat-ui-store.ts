import { create } from 'zustand'
import type { StreamState, EditingState, ComposerAttachment } from '@renderer/features/workbench/domain/types'

/**
 * Scroll state for a thread
 */
interface ScrollState {
  scrollTop: number
}

/**
 * Composer state for a thread
 */
interface ComposerState {
  draft: string
  attachments: ComposerAttachment[]
}

/**
 * Per-thread UI state that survives tab switches
 *
 * This state would be lost if we unmounted the component (as with LRU).
 * By storing it here, we preserve it regardless of which thread is active.
 */
export interface ThreadUIState {
  composer: ComposerState
  streaming: StreamState
  editing: EditingState | null
  scroll: ScrollState
  isSending: boolean
}

/**
 * Create default state for a new thread
 */
function createDefaultThreadState(): ThreadUIState {
  return {
    composer: { draft: '', attachments: [] },
    streaming: { status: 'idle' },
    editing: null,
    scroll: { scrollTop: 0 },
    isSending: false,
  }
}

/**
 * Chat UI Store
 *
 * Holds ephemeral per-thread state that needs to survive tab switches.
 * This replaces the component-owned state in the LRU model.
 */
interface ChatUIStore {
  threads: Map<string, ThreadUIState>

  /** Get thread state, creating default if missing */
  getThreadState: (threadId: string) => ThreadUIState

  // Composer actions
  setDraft: (threadId: string, draft: string) => void
  setAttachments: (threadId: string, attachments: ComposerAttachment[]) => void
  addAttachments: (threadId: string, attachments: ComposerAttachment[]) => void
  removeAttachment: (threadId: string, attachmentId: string) => void
  clearComposer: (threadId: string) => void

  // Streaming actions
  startStream: (threadId: string, streamId: string) => void
  applyDelta: (threadId: string, chunk: string) => void
  applyReasoning: (threadId: string, chunk: string) => void
  completeStream: (threadId: string) => void
  failStream: (threadId: string, error: string) => void
  resetStream: (threadId: string) => void

  // Editing actions
  startEditMessage: (threadId: string, messageId: string, role: 'user' | 'assistant') => void
  startEditSystemPrompt: (threadId: string) => void
  cancelEdit: (threadId: string) => void

  // Sending actions
  startSending: (threadId: string) => void
  stopSending: (threadId: string) => void

  // Scroll actions
  saveScrollPosition: (threadId: string, scrollTop: number) => void

  // Cleanup
  clearThread: (threadId: string) => void
}

/**
 * Helper to update a specific thread's state
 */
function updateThread(
  state: ChatUIStore,
  threadId: string,
  updater: (thread: ThreadUIState) => Partial<ThreadUIState>,
): Partial<ChatUIStore> {
  const threads = new Map(state.threads)
  const current = threads.get(threadId) ?? createDefaultThreadState()
  threads.set(threadId, { ...current, ...updater(current) })
  return { threads }
}

export const useChatUIStore = create<ChatUIStore>((set, get) => ({
  threads: new Map(),

  getThreadState: (threadId) => {
    const existing = get().threads.get(threadId)
    if (existing) return existing

    // Create and store default state
    const defaultState = createDefaultThreadState()
    set((state) => {
      const threads = new Map(state.threads)
      threads.set(threadId, defaultState)
      return { threads }
    })
    return defaultState
  },

  // Composer actions
  setDraft: (threadId, draft) =>
    set((state) =>
      updateThread(state, threadId, (t) => ({
        composer: { ...t.composer, draft },
      })),
    ),

  setAttachments: (threadId, attachments) =>
    set((state) =>
      updateThread(state, threadId, (t) => ({
        composer: { ...t.composer, attachments },
      })),
    ),

  addAttachments: (threadId, attachments) =>
    set((state) =>
      updateThread(state, threadId, (t) => ({
        composer: { ...t.composer, attachments: [...t.composer.attachments, ...attachments] },
      })),
    ),

  removeAttachment: (threadId, attachmentId) =>
    set((state) =>
      updateThread(state, threadId, (t) => ({
        composer: {
          ...t.composer,
          attachments: t.composer.attachments.filter((a) => a.id !== attachmentId),
        },
      })),
    ),

  clearComposer: (threadId) =>
    set((state) =>
      updateThread(state, threadId, () => ({
        composer: { draft: '', attachments: [] },
      })),
    ),

  // Streaming actions
  startStream: (threadId, streamId) =>
    set((state) =>
      updateThread(state, threadId, () => ({
        streaming: {
          status: 'streaming',
          id: streamId,
          content: '',
          reasoning: '',
          isThinking: false,
        },
      })),
    ),

  applyDelta: (threadId, chunk) =>
    set((state) =>
      updateThread(state, threadId, (t) => {
        if (t.streaming.status !== 'streaming') return {}
        return {
          streaming: {
            ...t.streaming,
            content: t.streaming.content + chunk,
            isThinking: false,
          },
        }
      }),
    ),

  applyReasoning: (threadId, chunk) =>
    set((state) =>
      updateThread(state, threadId, (t) => {
        if (t.streaming.status !== 'streaming') return {}
        return {
          streaming: {
            ...t.streaming,
            reasoning: t.streaming.reasoning + chunk,
            isThinking: true,
          },
        }
      }),
    ),

  completeStream: (threadId) =>
    set((state) =>
      updateThread(state, threadId, () => ({
        streaming: { status: 'idle' },
      })),
    ),

  failStream: (threadId, error) =>
    set((state) =>
      updateThread(state, threadId, () => ({
        streaming: { status: 'error', error },
      })),
    ),

  resetStream: (threadId) =>
    set((state) =>
      updateThread(state, threadId, () => ({
        streaming: { status: 'idle' },
      })),
    ),

  // Editing actions
  startEditMessage: (threadId, messageId, role) =>
    set((state) =>
      updateThread(state, threadId, () => ({
        editing:
          role === 'user'
            ? { kind: 'user-message', id: messageId, role }
            : { kind: 'assistant-message', id: messageId, role },
      })),
    ),

  startEditSystemPrompt: (threadId) =>
    set((state) =>
      updateThread(state, threadId, () => ({
        editing: { kind: 'system-prompt' },
      })),
    ),

  cancelEdit: (threadId) =>
    set((state) =>
      updateThread(state, threadId, () => ({
        editing: null,
      })),
    ),

  // Sending actions
  startSending: (threadId) =>
    set((state) =>
      updateThread(state, threadId, () => ({
        isSending: true,
      })),
    ),

  stopSending: (threadId) =>
    set((state) =>
      updateThread(state, threadId, () => ({
        isSending: false,
      })),
    ),

  // Scroll actions
  saveScrollPosition: (threadId, scrollTop) =>
    set((state) =>
      updateThread(state, threadId, () => ({
        scroll: { scrollTop },
      })),
    ),

  // Cleanup
  clearThread: (threadId) =>
    set((state) => {
      const threads = new Map(state.threads)
      threads.delete(threadId)
      return { threads }
    }),
}))
