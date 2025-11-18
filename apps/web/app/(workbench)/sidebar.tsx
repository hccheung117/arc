'use client'

import { useEffect, useState, useRef, type Dispatch } from 'react'
import { MessageSquare, PenSquare } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ChatThread } from './chat-thread'
import type { ThreadAction } from './use-chat-threads'
import { showThreadContextMenu, deleteConversation, renameConversation } from '@/lib/core/conversations'

const TRAFFIC_LIGHT_FALLBACK = { top: 0, left: 0 }

interface WindowControlsOverlay extends EventTarget {
  getTitlebarAreaRect: () => { height: number; x: number }
  addEventListener: (event: string, handler: () => void) => void
  removeEventListener: (event: string, handler: () => void) => void
}

interface NavigatorWithWindowControls extends Navigator {
  windowControlsOverlay?: WindowControlsOverlay
}

interface WorkbenchSidebarProps {
  threads: ChatThread[]
  activeThreadId: string | null
  onThreadSelect: (threadId: string | null) => void
  dispatch: Dispatch<ThreadAction>
}

export function WorkbenchSidebar({ threads, activeThreadId, onThreadSelect, dispatch }: WorkbenchSidebarProps) {
  const [trafficLightInsets, setTrafficLightInsets] = useState(TRAFFIC_LIGHT_FALLBACK)
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateTrafficLightInsets = () => {
      const nav = navigator as NavigatorWithWindowControls
      if (nav.windowControlsOverlay) {
        const overlay = nav.windowControlsOverlay
        if (typeof overlay.getTitlebarAreaRect === 'function') {
          const rect = overlay.getTitlebarAreaRect()
          setTrafficLightInsets({
            top: rect.height || TRAFFIC_LIGHT_FALLBACK.top,
            left: rect.x || TRAFFIC_LIGHT_FALLBACK.left,
          })
        }
      }
    }

    updateTrafficLightInsets()

    const nav = navigator as NavigatorWithWindowControls
    if (nav.windowControlsOverlay) {
      const overlay = nav.windowControlsOverlay
      overlay.addEventListener('geometrychange', updateTrafficLightInsets)
      return () => {
        overlay.removeEventListener('geometrychange', updateTrafficLightInsets)
      }
    }
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--traffic-light-top', `${trafficLightInsets.top}px`)
    document.documentElement.style.setProperty('--traffic-light-left', `${trafficLightInsets.left}px`)
  }, [trafficLightInsets])

  useEffect(() => {
    if (editingThreadId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingThreadId])

  const handleContextMenu = async (thread: ChatThread, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const action = await showThreadContextMenu()

    if (action === 'rename') {
      setEditingThreadId(thread.threadId)
      setEditingTitle(thread.title)
    } else if (action === 'delete' && thread.conversationId) {
      // Delete from backend
      await deleteConversation(thread.conversationId)
      // Remove from local state
      dispatch({ type: 'DELETE_THREAD', threadId: thread.threadId })
      // If this was the active thread, clear selection
      if (activeThreadId === thread.threadId) {
        onThreadSelect(null)
      }
    }
  }

  const handleSaveRename = async (thread: ChatThread) => {
    if (!editingTitle.trim() || !thread.conversationId) {
      // Cancel if empty or no conversationId
      setEditingThreadId(null)
      return
    }

    // Update backend
    await renameConversation(thread.conversationId, editingTitle)
    // Update local state
    dispatch({ type: 'RENAME_THREAD', threadId: thread.threadId, title: editingTitle })
    // Exit editing mode
    setEditingThreadId(null)
  }

  const handleCancelRename = () => {
    setEditingThreadId(null)
    setEditingTitle('')
  }

  const handleKeyDown = (e: React.KeyboardEvent, thread: ChatThread) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveRename(thread)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelRename()
    }
  }

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div
        className="flex flex-col h-full"
        style={{
          paddingTop: `${trafficLightInsets.top}px`,
        }}
      >
        <div className="px-2 py-2">
          <Button className="w-full justify-start gap-2" variant="outline" onClick={() => onThreadSelect(null)}>
            <PenSquare className="h-4 w-4" />
            New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <nav className="pl-2 pr-1 pt-1 pb-2">
            <ul className="space-y-1">
              {threads
                .filter((thread) => thread.conversationId !== null)
                .map((thread) => (
                  <li key={thread.threadId}>
                    <button
                      onClick={() => onThreadSelect(thread.threadId)}
                      onContextMenu={(e) => handleContextMenu(thread, e)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        activeThreadId === thread.threadId
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground'
                      )}
                    >
                      <MessageSquare className="h-4 w-4 flex-shrink-0" />
                      {editingThreadId === thread.threadId ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, thread)}
                          onBlur={() => handleSaveRename(thread)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 bg-transparent border-none outline-none text-sm"
                        />
                      ) : (
                        <span className="truncate">{thread.title}</span>
                      )}
                    </button>
                  </li>
                ))}
            </ul>
          </nav>
        </ScrollArea>
      </div>
    </div>
  )
}
