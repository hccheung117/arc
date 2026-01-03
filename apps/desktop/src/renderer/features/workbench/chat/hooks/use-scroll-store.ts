import { useEffect, useState, useCallback, useRef } from 'react'
import { useChatUIStore } from '../stores/chat-ui-store'

/**
 * Auto-Scroll with Store Persistence
 *
 * Extends the user-action-centric auto-scroll pattern with store persistence:
 * - FOLLOW mode: Auto-stick to bottom when new content arrives
 * - MANUAL mode: User controls viewport
 *
 * On tab switch:
 * - Saves scrollTop + isManualMode to store
 * - Restores from store when returning to tab
 *
 * @see use-auto-scroll.ts for the original design rationale
 */

const BOTTOM_THRESHOLD = 50

interface UseScrollStoreReturn {
  isAtBottom: boolean
  scrollToBottom: () => void
}

export function useScrollStore(
  viewport: HTMLDivElement | null,
  streamingContent: string | undefined,
  threadId: string,
): UseScrollStoreReturn {
  const [isAtBottom, setIsAtBottom] = useState(true)

  // FOLLOW (false) vs MANUAL (true) - only user scrolls change this
  const isManualModeRef = useRef(false)

  // Guard to ignore scroll events we caused
  const isProgrammaticScrollRef = useRef(false)

  // Track previous threadId to detect tab switches
  const previousThreadIdRef = useRef<string | null>(null)

  // Restore scroll position from store (deferred until content renders)
  const restoreScrollPosition = useCallback(() => {
    if (!viewport) return

    const saved = useChatUIStore.getState().getThreadState(threadId).scroll

    // Apply the scroll position once content is ready
    const applyScroll = () => {
      if (!viewport) return

      if (saved.isManualMode && saved.scrollTop > 0) {
        isProgrammaticScrollRef.current = true
        isManualModeRef.current = true
        viewport.scrollTop = saved.scrollTop
        setIsAtBottom(false)
      } else {
        isProgrammaticScrollRef.current = true
        isManualModeRef.current = false
        viewport.scrollTop = viewport.scrollHeight
        setIsAtBottom(true)
      }
    }

    // We need content to be ready before scrolling. For manual mode, we need
    // scrollHeight >= savedScrollTop. For follow mode, we need scrollHeight to
    // stabilize (be "reasonable" - more than a minimal loading state).
    const MIN_CONTENT_HEIGHT = 500

    let attempts = 0
    const maxAttempts = 10

    const tryRestore = () => {
      if (!viewport) return

      const isManualRestore = saved.isManualMode && saved.scrollTop > 0
      const contentReady = isManualRestore
        ? viewport.scrollHeight >= saved.scrollTop
        : viewport.scrollHeight >= MIN_CONTENT_HEIGHT || viewport.scrollHeight >= saved.scrollTop

      if (contentReady) {
        applyScroll()
        return
      }

      attempts++
      if (attempts < maxAttempts) {
        requestAnimationFrame(tryRestore)
      } else {
        // Fallback: apply anyway after max attempts
        applyScroll()
      }
    }

    requestAnimationFrame(tryRestore)
  }, [viewport, threadId])

  // Handle thread change: save old, restore new
  useEffect(() => {
    const prevThreadId = previousThreadIdRef.current

    // Save position for previous thread (if any)
    if (prevThreadId && prevThreadId !== threadId && viewport) {
      useChatUIStore.getState().saveScrollPosition(
        prevThreadId,
        viewport.scrollTop,
        isManualModeRef.current,
      )
    }

    // Restore position for new thread (after viewport is ready)
    if (viewport) {
      restoreScrollPosition()
    }

    previousThreadIdRef.current = threadId
  }, [threadId, viewport, restoreScrollPosition])

  // User scroll handler - mode changes only on user scroll
  useEffect(() => {
    if (!viewport) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      const nearBottom = distanceFromBottom <= BOTTOM_THRESHOLD

      // Ignore our own scrolls
      if (isProgrammaticScrollRef.current) {
        isProgrammaticScrollRef.current = false
        setIsAtBottom(nearBottom)
        return
      }

      // User scroll: mode changes based on where they landed
      isManualModeRef.current = !nearBottom
      setIsAtBottom(nearBottom)
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', handleScroll)
  }, [viewport, threadId])

  // Content arrival: scroll only if in FOLLOW mode
  useEffect(() => {
    if (!viewport || streamingContent === undefined) return

    // MANUAL mode: do nothing
    if (isManualModeRef.current) return

    // FOLLOW mode: pin to bottom
    isProgrammaticScrollRef.current = true
    viewport.scrollTop = viewport.scrollHeight
  }, [viewport, streamingContent])

  // Manual button: jump to bottom and enter FOLLOW mode
  const scrollToBottom = useCallback(() => {
    if (!viewport) return

    isProgrammaticScrollRef.current = true
    isManualModeRef.current = false
    viewport.scrollTop = viewport.scrollHeight
    setIsAtBottom(true)
  }, [viewport])

  return { isAtBottom, scrollToBottom }
}
