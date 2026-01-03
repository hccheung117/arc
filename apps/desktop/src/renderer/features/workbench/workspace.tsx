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

    fetchModels()

    const unsubscribe = onModelsEvent((event) => {
      if (event.type === 'updated') {
        fetchModels()
      }
    })

    return unsubscribe
  }, [])

  // Find the active thread
  const activeThread = threads.find((t) => t.id === activeThreadId)

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
