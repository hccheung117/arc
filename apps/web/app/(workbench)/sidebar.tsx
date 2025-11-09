'use client'

import { useEffect, useState } from 'react'
import { MessageSquare, PenSquare } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ConversationSummary } from '@arc/core/src/conversations/types'
import { getConversationSummaries } from '@arc/core/src/conversations/api'

const TRAFFIC_LIGHT_FALLBACK = { top: 0, left: 0 }

interface WorkbenchSidebarProps {
  activeChatId: string | null
  onChatSelect: (chatId: string) => void
}

export function WorkbenchSidebar({ activeChatId, onChatSelect }: WorkbenchSidebarProps) {
  const [trafficLightInsets, setTrafficLightInsets] = useState(TRAFFIC_LIGHT_FALLBACK)
  const conversations = getConversationSummaries()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateTrafficLightInsets = () => {
      if ('windowControlsOverlay' in navigator) {
        const overlay = (navigator as any).windowControlsOverlay
        if (overlay && typeof overlay.getTitlebarAreaRect === 'function') {
          const rect = overlay.getTitlebarAreaRect()
          setTrafficLightInsets({
            top: rect.height || TRAFFIC_LIGHT_FALLBACK.top,
            left: rect.x || TRAFFIC_LIGHT_FALLBACK.left,
          })
        }
      }
    }

    updateTrafficLightInsets()

    if ('windowControlsOverlay' in navigator) {
      const overlay = (navigator as any).windowControlsOverlay
      if (overlay) {
        overlay.addEventListener?.('geometrychange', updateTrafficLightInsets)
        return () => {
          overlay.removeEventListener?.('geometrychange', updateTrafficLightInsets)
        }
      }
    }
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--traffic-light-top', `${trafficLightInsets.top}px`)
    document.documentElement.style.setProperty('--traffic-light-left', `${trafficLightInsets.left}px`)
  }, [trafficLightInsets])

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div
        className="flex flex-col h-full"
        style={{
          paddingTop: `${trafficLightInsets.top}px`,
        }}
      >
        <div className="px-2 py-2">
          <Button
            className="w-full justify-start gap-2"
            variant="outline"
          >
            <PenSquare className="h-4 w-4" />
            New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <nav className="pl-2 pr-1 pt-1 pb-2">
            <ul className="space-y-1">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    onClick={() => onChatSelect(conversation.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                      'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      activeChatId === conversation.id
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground'
                    )}
                  >
                    <MessageSquare className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{conversation.title}</span>
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
