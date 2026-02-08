import { useEffect, useState } from 'react'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { ChatView } from './chat-view'
import { getModels } from '@renderer/lib/models'
import { usePersonas } from '@renderer/hooks/use-personas'

/** Recursively finds a thread by ID in the tree (folders have nested children) */
const findThreadInTree = (threads, id) => {
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
export function Workspace({ threads, activeThreadId, onThreadUpdate }) {
  const [models, setModels] = useState([])
  const { findPersona } = usePersonas()

  // Fetch models on mount and when active profile changes
  useEffect(() => {
    const fetchModels = () => {
      getModels().then(setModels)
    }

    fetchModels()

    // Re-fetch when profile changes (install/uninstall/activate)
    const unsub1 = window.arc.profiles.onInstalled(fetchModels)
    const unsub2 = window.arc.profiles.onUninstalled(fetchModels)
    const unsub3 = window.arc.settings.onActivated(fetchModels)
    return () => { unsub1(); unsub2(); unsub3() }
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
          findPersona={findPersona}
          onThreadUpdate={onThreadUpdate}
        />
      </div>
    </TooltipProvider>
  )
}
