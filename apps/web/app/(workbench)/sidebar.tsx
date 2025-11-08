'use client'

import { useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { ScrollArea } from '@/components/ui/scroll-area'

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
    <Sidebar collapsible="none" className="border-r w-full h-full">
      <div
        className="flex flex-col h-full"
        style={{
          paddingTop: `${trafficLightInsets.top}px`,
        }}
      >
        <SidebarContent className="flex-1">
          <ScrollArea className="h-full">
            <SidebarMenu>
              {mockChats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton
                    isActive={activeChat === chat.id}
                    onClick={() => setActiveChat(chat.id)}
                  >
                    <MessageSquare />
                    <span>{chat.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </ScrollArea>
        </SidebarContent>
      </div>
    </Sidebar>
  )
}
