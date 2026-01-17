import { useEffect, useState, useCallback, useRef } from 'react'
import { useChatUIStore } from '@renderer/stores/chat-ui-store'

/**
 * Simple Scroll Behavior
 *
 * One rule: When user sends a message, scroll to show the AI response.
 * No other auto-scrolling. User controls their own viewport.
 *
 * Tab switch: saves/restores scrollTop position.
 */

const BOTTOM_THRESHOLD = 50
const SCROLL_PADDING = 50

export function useScrollStore(
  viewport: HTMLDivElement | null,
  threadId: string,
  scrollTargetId: string | null,
): { isAtBottom: boolean; scrollToBottom: () => void } {
  const [isAtBottom, setIsAtBottom] = useState(true)

  // Track previous threadId to detect tab switches
  const previousThreadIdRef = useRef<string | null>(null)

  // Track which message we've scrolled to (prevent duplicate scrolls)
  const scrolledForMessageRef = useRef<string | null>(null)

  // Restore scroll position from store
  const restoreScrollPosition = useCallback(() => {
    if (!viewport) return

    const saved = useChatUIStore.getState().getThreadState(threadId).scroll

    const applyScroll = () => {
      if (!viewport) return
      viewport.scrollTop = saved.scrollTop
      updateIsAtBottom()
    }

    // Wait for content to be ready
    let attempts = 0
    const maxAttempts = 10

    const tryRestore = () => {
      if (!viewport) return

      if (viewport.scrollHeight >= saved.scrollTop || attempts >= maxAttempts) {
        applyScroll()
        return
      }

      attempts++
      requestAnimationFrame(tryRestore)
    }

    requestAnimationFrame(tryRestore)
  }, [viewport, threadId])

  // Helper to update isAtBottom state
  const updateIsAtBottom = useCallback(() => {
    if (!viewport) return
    const { scrollTop, scrollHeight, clientHeight } = viewport
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    setIsAtBottom(distanceFromBottom <= BOTTOM_THRESHOLD)
  }, [viewport])

  // Handle thread change: save old, restore new
  useEffect(() => {
    const prevThreadId = previousThreadIdRef.current

    // Save position for previous thread
    if (prevThreadId && prevThreadId !== threadId && viewport) {
      useChatUIStore.getState().saveScrollPosition(prevThreadId, viewport.scrollTop)
    }

    // Restore position for new thread
    if (viewport) {
      restoreScrollPosition()
    }

    // Reset scroll tracker for new thread
    scrolledForMessageRef.current = null
    previousThreadIdRef.current = threadId
  }, [threadId, viewport, restoreScrollPosition])

  // Simple scroll listener to track isAtBottom
  useEffect(() => {
    if (!viewport) return

    const handleScroll = () => updateIsAtBottom()

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', handleScroll)
  }, [viewport, updateIsAtBottom])

  // Scroll to target message (AI response) when it appears
  useEffect(() => {
    if (!viewport || !scrollTargetId) return

    // Already scrolled for this message
    if (scrolledForMessageRef.current === scrollTargetId) return

    scrolledForMessageRef.current = scrollTargetId

    requestAnimationFrame(() => {
      const el = document.getElementById(scrollTargetId)
      if (el && viewport) {
        viewport.scrollTop = Math.max(0, el.offsetTop - SCROLL_PADDING)
        updateIsAtBottom()
      }
    })
  }, [viewport, scrollTargetId, updateIsAtBottom])

  // Manual scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
    setIsAtBottom(true)
  }, [viewport])

  return { isAtBottom, scrollToBottom }
}
