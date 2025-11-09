'use client'

import { useState, useCallback, useEffect } from 'react'
import { WorkbenchSidebar } from './sidebar'
import { Workspace } from './workspace'

const MIN_SIDEBAR_WIDTH = 200
const MAX_SIDEBAR_WIDTH = 400
const DEFAULT_SIDEBAR_WIDTH = 280

export default function WorkbenchPage() {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  const handleMouseDown = useCallback(() => {
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return

      const newWidth = e.clientX
      if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
        setSidebarWidth(newWidth)
      }
    },
    [isResizing]
  )

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  return (
    <div className="flex h-screen overflow-hidden">
      <aside style={{ width: `${sidebarWidth}px` }} className="flex-shrink-0">
        <WorkbenchSidebar activeChatId={activeChatId} onChatSelect={setActiveChatId} />
      </aside>

      <div
        onMouseDown={handleMouseDown}
        className="w-1 bg-sidebar cursor-col-resize border-r border-sidebar-border hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-all flex-shrink-0"
        style={{ userSelect: 'none' }}
      />

      <main className="flex-1 min-w-0 bg-white dark:bg-black">
        <Workspace conversationId={activeChatId} />
      </main>
    </div>
  )
}
