import { useEffect, useState } from 'react'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { ChatView } from './chat/components/view'
import type { Model } from '@arc-types/models'
import { getModels, onModelsEvent } from '@renderer/lib/models'
import type { ChatThread, ThreadAction } from '@renderer/lib/threads'

interface WorkspaceProps {
  threads: ChatThread[]
  activeThreadId: string | null
  onThreadUpdate: (action: ThreadAction) => void
}

/** Recursively finds a thread by ID in the tree (folders have nested children) */
const findThreadInTree = (threads: ChatThread[], id: string): ChatThread | undefined => {
  for (const thread of threads) {
    if (thread.id === id) return thread
    if (thread.children.length > 0) {
      const found = findThreadInTree(thread.children, id)
      if (found) return found
    }
  }
  return undefined
}

/**
 * Workspace: Simple orchestrator for chat view
 *
 * Manages:
 * - Model list (shared resource, fetched once)
 * - Active thread display
 *
 * State for each thread is preserved in the global store,
 * allowing instant switching without state loss.
 */
export function Workspace({ threads, activeThreadId, onThreadUpdate }: WorkspaceProps) {
  const [models, setModels] = useState<Model[]>([])

  // Fetch and subscribe to model updates (shared resource)
  useEffect(() => {
    const fetchModels = () => {
      getModels().then(setModels)
    }

    // Subscribe first to avoid race with main process startup fetch
    const unsubscribe = onModelsEvent((event) => {
      if (event.type === 'updated') {
        fetchModels()
      }
    })

    fetchModels()

    return unsubscribe
  }, [])

  // Find the active thread (recursive search through folder children)
  const activeThread = findThreadInTree(threads, activeThreadId ?? '')

  if (!activeThread) return null

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden">
        <ChatView
          thread={activeThread}
          models={models}
          onThreadUpdate={onThreadUpdate}
        />
      </div>
    </TooltipProvider>
  )
}
