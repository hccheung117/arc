import { create } from 'zustand'

/**
 * Create default state for a new thread
 */
function createDefaultThreadState() {
  return {
    composer: { draft: '', attachments: [] },
    streaming: { status: 'idle' },
    editing: null,
    scroll: { scrollTop: 0 },
    isSending: false,
  }
}

/**
 * Helper to update a specific thread's state
 */
function updateThread(
  state,
  threadId,
  updater,
) {
  const threads = new Map(state.threads)
  const current = threads.get(threadId) ?? createDefaultThreadState()
  threads.set(threadId, { ...current, ...updater(current) })
  return { threads }
}

export const useChatUIStore = create((set, get) => ({
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
