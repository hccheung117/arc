import { useState, useEffect, useCallback } from 'react'
import { FileDown } from 'lucide-react'
import { SidebarProvider, SidebarInset } from '@renderer/components/ui/sidebar'
import { WorkbenchSidebar } from '@renderer/features/workbench/sidebar'
import { Workspace } from '@renderer/features/workbench/workspace'
import { useChatThreads } from '@renderer/features/workbench/use-chat-threads'
import { DropOverlay } from '@renderer/components/drop-overlay'
import { useFileDrop } from '@renderer/hooks/use-file-drop'

export function WorkbenchWindow() {
  const { threads, dispatch } = useChatThreads()
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)

  const handleImport = useCallback(async (filePath: string) => {
    try {
      const result = await window.arc.import.file(filePath)
      const msg = `Imported ${result.providersAdded} new, updated ${result.providersUpdated} existing providers`
      setImportMessage(msg)
      setTimeout(() => setImportMessage(null), 4000)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Import failed'
      setImportMessage(`Error: ${msg}`)
      setTimeout(() => setImportMessage(null), 4000)
    }
  }, [])

  const { isDragging } = useFileDrop({
    extension: '.arc',
    onDrop: handleImport,
  })

  // Subscribe to import events (for dock drops)
  useEffect(() => {
    const cleanup = window.arc.import.onEvent((event) => {
      if (event.type === 'success') {
        const { result } = event
        const msg = `Imported ${result.providersAdded} new, updated ${result.providersUpdated} existing providers`
        setImportMessage(msg)
        setTimeout(() => setImportMessage(null), 4000)
      } else if (event.type === 'error') {
        setImportMessage(`Error: ${event.error}`)
        setTimeout(() => setImportMessage(null), 4000)
      }
    })
    return cleanup
  }, [])

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <DropOverlay
        isVisible={isDragging}
        icon={FileDown}
        title="Drop to import configuration"
        description="Release to import providers from .arc file"
      />

      <WorkbenchSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onThreadSelect={setActiveThreadId}
        dispatch={dispatch}
      />
      <SidebarInset className="overflow-hidden">
        <div className="flex-1 min-w-0 bg-white dark:bg-black h-full">
          <Workspace
            threads={threads}
            activeThreadId={activeThreadId}
            onThreadUpdate={dispatch}
            onActiveThreadChange={setActiveThreadId}
          />
        </div>
      </SidebarInset>

      {/* Import feedback message */}
      {importMessage && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-primary px-4 py-2 text-label text-primary-foreground shadow-lg">
          {importMessage}
        </div>
      )}
    </SidebarProvider>
  )
}

