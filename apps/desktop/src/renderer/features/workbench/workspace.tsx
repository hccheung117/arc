import { useEffect, useState } from 'react'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { ChatView } from './chat/components/view'
import type { Model } from '@arc-types/models'
import { getModels, onModelsEvent } from '@renderer/lib/models'
import type { ChatThread } from './chat/thread'
import type { ThreadAction } from './chat/use-threads'

interface WorkspaceProps {
  threads: ChatThread[]
  activeThreadId: string | null
  onThreadUpdate: (action: ThreadAction) => void
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
 * - Model list (shared resource, fetched once)
 * - LRU-based GC for ChatView instances
 *
 * Each mounted ChatView is an independent "process" with isolated state,
 * including its own model selection.
 */
export function Workspace({ threads, activeThreadId, onThreadUpdate }: WorkspaceProps) {
  // Shared resource: available models (fetched once, passed to all)
  const [models, setModels] = useState<Model[]>([])

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

  // Fetch and subscribe to model updates (shared resource)
  useEffect(() => {
    const fetchModels = () => {
      getModels().then(setModels)
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

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden">
        {/* Mounted ChatView instances - each has its own model selector */}
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
                models={models}
                onThreadUpdate={onThreadUpdate}
              />
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
