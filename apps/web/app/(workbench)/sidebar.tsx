'use client'

import { useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

type Chat = {
  id: string
  title: string
}

const mockChats: Chat[] = [
  { id: '1', title: 'Greeting exchange' },
  { id: '2', title: 'Project planning discussion' },
  { id: '3', title: 'Code review feedback' },
  { id: '4', title: 'Bug fix strategy' },
  { id: '5', title: 'Feature implementation' },
  { id: '6', title: 'API design review' },
  { id: '7', title: 'Testing strategy' },
  { id: '8', title: 'Performance optimization' },
  { id: '9', title: 'Documentation update' },
  { id: '10', title: 'Deployment workflow' },
]

const TRAFFIC_LIGHT_FALLBACK = { top: 0, left: 0 }

export function WorkbenchSidebar() {
  const [activeChat, setActiveChat] = useState('1')
  const [trafficLightInsets, setTrafficLightInsets] = useState(TRAFFIC_LIGHT_FALLBACK)

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
        <ScrollArea className="flex-1">
          <nav className="pl-2 pr-1 py-2">
            <ul className="space-y-1">
              {mockChats.map((chat) => (
                <li key={chat.id}>
                  <button
                    onClick={() => setActiveChat(chat.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                      'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      activeChat === chat.id
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground'
                    )}
                  >
                    <MessageSquare className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{chat.title}</span>
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
