'use client'

import { useState, useCallback, useEffect } from 'react'
import { SidebarProvider } from '@/components/ui/sidebar'
import { WorkbenchSidebar } from './sidebar'

const MIN_SIDEBAR_WIDTH = 200
const MAX_SIDEBAR_WIDTH = 400
const DEFAULT_SIDEBAR_WIDTH = 280

export default function WorkbenchPage() {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [isResizing, setIsResizing] = useState(false)

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
    <SidebarProvider>
      <div className="flex h-screen">
        <aside style={{ width: `${sidebarWidth}px` }}>
          <WorkbenchSidebar />
        </aside>

        <div
          onMouseDown={handleMouseDown}
          className="cursor-col-resize border-r border-neutral-200 hover:bg-neutral-300 hover:w-1 dark:border-neutral-800 dark:hover:bg-neutral-700 transition-all"
          style={{ userSelect: 'none' }}
        />

        <main className="flex-1 bg-white dark:bg-black" />
      </div>
    </SidebarProvider>
  )
}
