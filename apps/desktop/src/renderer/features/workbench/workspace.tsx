import { useEffect, useState } from 'react'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { EmptyState } from './empty-state'
import { ModelSelector } from './model-selector'
import { ChatView } from './chat-view'
import type { Model } from '@arc-types/models'
import type { AttachmentInput } from '@arc-types/arc-api'
import { getModels, onModelsEvent } from '@renderer/lib/models'
import { createMessage, startAIChat } from '@renderer/lib/messages'
import type { ChatThread } from './chat-thread'
import { createDraftThread } from './chat-thread'
import type { ThreadAction } from './use-chat-threads'
import { Composer } from './composer'

interface WorkspaceProps {
  threads: ChatThread[]
  activeThreadId: string | null
  onThreadUpdate: (action: ThreadAction) => void
  onActiveThreadChange: (threadId: string) => void
}

/**
 * Maximum number of ChatView instances to keep mounted.
 * Recent chats stay in memory for quick switching; older ones unmount.
 */
const MAX_MOUNTED = 5

/**
 * Workspace: Thin orchestrator for chat instances
 *
 * Manages:
 * - Model selection (shared across all chats)
 * - LRU-based GC for ChatView instances
 * - New chat flow (empty state -> draft creation)
 *
 * Each mounted ChatView is an independent "process" with isolated state.
 */
export function Workspace({ threads, activeThreadId, onThreadUpdate, onActiveThreadChange }: WorkspaceProps) {
  // Shared state: model selection
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)

  // LRU tracking for GC: most recently accessed thread IDs
  const [accessOrder, setAccessOrder] = useState<string[]>([])

  // Update access order when switching chats (LRU)
  useEffect(() => {
    if (!activeThreadId) return
    setAccessOrder((prev) => {
      const filtered = prev.filter((id) => id !== activeThreadId)
      return [activeThreadId, ...filtered]
    })
  }, [activeThreadId])

  // Persist model selection to localStorage
  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem('arc:selectedModelId', selectedModel.id)
    }
  }, [selectedModel])

  // Fetch and subscribe to model updates
  useEffect(() => {
    const fetchModels = () => {
      getModels().then((fetchedModels) => {
        setModels(fetchedModels)

        setSelectedModel((prev) => {
          if (prev) return prev

          if (fetchedModels.length > 0) {
            const savedModelId = localStorage.getItem('arc:selectedModelId')
            const savedModel = savedModelId
              ? fetchedModels.find((m) => m.id === savedModelId)
              : null
            return savedModel || fetchedModels[0]
          }

          return null
        })
      })
    }

    fetchModels()

    const unsubscribe = onModelsEvent((event) => {
      if (event.type === 'updated') {
        fetchModels()
      }
    })

    return unsubscribe
  }, [])

  // Determine which threads to keep mounted (LRU eviction)
  // Always include activeThreadId to avoid flash of empty content
  const mountedIds = new Set([
    ...(activeThreadId ? [activeThreadId] : []),
    ...accessOrder.slice(0, MAX_MOUNTED - 1), // -1 to account for active
  ])

  // Handler for new chat creation (from empty state)
  // Creates the draft, first message, and starts AI response before switching
  const handleNewChatMessage = async (content: string, attachments?: AttachmentInput[]) => {
    if (!selectedModel) return

    // Create draft thread
    const draft = createDraftThread()
    const threadId = draft.id

    onThreadUpdate({
      type: 'CREATE_DRAFT',
      id: threadId,
    })

    // Create the first user message
    await createMessage(
      threadId,
      'user',
      content,
      null, // no parent for first message
      selectedModel.id,
      selectedModel.provider.id,
      attachments,
    )

    // Start AI response
    onThreadUpdate({
      type: 'UPDATE_STATUS',
      id: threadId,
      status: 'streaming',
    })

    const { streamId } = await startAIChat(threadId, selectedModel.id)

    // Store the active stream info for ChatView to pick up
    sessionStorage.setItem('arc:activeStream', JSON.stringify({ threadId, streamId }))

    // Switch to the new thread - ChatView will mount and pick up the stream
    onActiveThreadChange(threadId)
  }

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden">
        <header className="flex h-14 items-center border-b border-sidebar-border px-6 shrink-0">
          <ModelSelector
            selectedModel={selectedModel}
            onModelSelect={setSelectedModel}
            models={models}
          />
        </header>

        {/* New chat empty state */}
        {activeThreadId === null && (
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
            <div className="flex flex-1 min-h-0 items-center justify-center">
              <EmptyState />
            </div>
            <div className="shrink-0">
              <Composer
                onSend={handleNewChatMessage}
                onStop={() => {}}
                isStreaming={false}
                isEditing={false}
                onCancelEdit={() => {}}
              />
            </div>
          </div>
        )}

        {/* Mounted ChatView instances */}
        {threads.map((thread) => {
          const shouldMount = mountedIds.has(thread.id)
          const isVisible = thread.id === activeThreadId

          if (!shouldMount) return null

          return (
            <div
              key={thread.id}
              className={`flex-1 min-h-0 ${isVisible ? '' : 'hidden'}`}
            >
              <ChatView
                thread={thread}
                selectedModel={selectedModel}
                onThreadUpdate={onThreadUpdate}
              />
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
