import { useEffect, useState } from 'react'
import { PenSquare } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
} from '@renderer/components/ui/sidebar'
import { SidebarList } from './list'
import { createDraftThread } from '../chat/thread'
import type { ChatThread } from '../chat/thread'
import type { ThreadAction } from '../chat/use-threads'
import type { Dispatch } from 'react'

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

  return (
    <Sidebar className="p-2 bg-sidebar">
      <SidebarHeader style={{ paddingTop: `${trafficLightInsets.top}px` }} className="p-0 pt-0 pb-3 bg-sidebar">
        <Button
          className="w-full justify-start gap-2"
          variant="outline"
          onClick={() => {
            const draft = createDraftThread()
            dispatch({ type: 'CREATE_DRAFT', id: draft.id })
            onThreadSelect(draft.id)
          }}
        >
          <PenSquare className="h-4 w-4" />
          New Chat
        </Button>
      </SidebarHeader>
      <SidebarContent className="p-0 bg-sidebar">
        <SidebarList
          threads={threads}
          activeThreadId={activeThreadId}
          onThreadSelect={onThreadSelect}
          dispatch={dispatch}
        />
      </SidebarContent>
      <SidebarFooter className="p-0 bg-sidebar" />
      <SidebarRail />
    </Sidebar>
  )
}
