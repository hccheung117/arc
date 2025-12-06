import { useEffect, useState, useCallback, useRef } from 'react'

/**
 * User-Action-Centric Auto-Scroll
 *
 * ## Core Principle
 *
 * State comes from USER ACTIONS, not from geometry.
 *
 * The mode flag (FOLLOW vs MANUAL) changes ONLY when the user scrolls.
 * Content arrival NEVER changes the mode—it only triggers scroll adjustments
 * if we're already in FOLLOW mode.
 *
 * ## Two Modes
 *
 * - FOLLOW: Auto-stick to bottom when new content arrives
 * - MANUAL: Never move viewport; user is in charge
 *
 * ## State Transitions
 *
 * | Event              | Action                                           |
 * |--------------------|--------------------------------------------------|
 * | User scrolls UP    | → MANUAL (they want to read history)             |
 * | User scrolls DOWN  | Check final position: near bottom? → FOLLOW      |
 * | Content arrives    | FOLLOW: scroll to bottom. MANUAL: do nothing.    |
 * | Programmatic scroll| No mode change (we caused it, not user)          |
 *
 * ## Why This Works
 *
 * Previous approaches checked geometry on content arrival:
 * "If near bottom → follow, else stop following"
 *
 * This breaks when a big chunk arrives—suddenly you're "far from bottom"
 * for one frame, and the logic incorrectly thinks user scrolled away.
 *
 * With user-action-centric design, chunk size doesn't matter:
 * - FOLLOW + big chunk = yank viewport to new bottom
 * - MANUAL + big chunk = viewport stays put
 *
 * The mode only changes when the USER explicitly scrolls.
 */

const BOTTOM_THRESHOLD = 50

// Debug logging - enabled in development, disabled in production
const DEBUG = process.env.NODE_ENV !== 'production'

interface UseAutoScrollReturn {
  isAtBottom: boolean
  scrollToBottom: () => void
}

export function useAutoScroll(
  viewport: HTMLDivElement | null,
  streamingContent: string | undefined,
  chatId?: string | null
): UseAutoScrollReturn {
  const [isAtBottom, setIsAtBottom] = useState(true)

  // FOLLOW (false) vs MANUAL (true) - only user scrolls change this
  const isManualModeRef = useRef(false)

  // Guard to ignore scroll events we caused
  const isProgrammaticScrollRef = useRef(false)

  /**
   * User Scroll Handler
   *
   * Only place where mode changes. Examines where the user ended up:
   * - Near bottom → FOLLOW mode
   * - Away from bottom → MANUAL mode
   */
  useEffect(() => {
    if (!viewport) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      const nearBottom = distanceFromBottom <= BOTTOM_THRESHOLD

      // Ignore our own scrolls - they don't reflect user intent
      if (isProgrammaticScrollRef.current) {
        isProgrammaticScrollRef.current = false
        setIsAtBottom(nearBottom)
        return
      }

      // User scroll: mode changes based on where they landed
      const wasManual = isManualModeRef.current
      isManualModeRef.current = !nearBottom

      if (DEBUG) {
        if (wasManual && nearBottom) {
          console.log('[AutoScroll] MANUAL → FOLLOW (user reached bottom)')
        } else if (!wasManual && !nearBottom) {
          console.log(`[AutoScroll] FOLLOW → MANUAL (user scrolled up, dist=${Math.round(distanceFromBottom)}px)`)
        }
      }

      setIsAtBottom(nearBottom)
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', handleScroll)
  }, [viewport])

  /**
   * Chat Change: Reset to FOLLOW mode at bottom
   */
  useEffect(() => {
    if (!viewport) return

    isProgrammaticScrollRef.current = true
    isManualModeRef.current = false
    viewport.scrollTop = viewport.scrollHeight
    setIsAtBottom(true)

    if (DEBUG) {
      console.log(`[AutoScroll] CHAT_CHANGE → FOLLOW (chatId=${chatId?.slice(0, 8)})`)
    }
  }, [viewport, chatId])

  /**
   * Content Arrival: Scroll only if in FOLLOW mode
   *
   * Key rule: This effect NEVER changes the mode.
   * It only performs the scroll adjustment if we're already following.
   */
  useEffect(() => {
    if (!viewport || streamingContent === undefined) return

    // MANUAL mode: do nothing, user is in charge
    if (isManualModeRef.current) {
      return
    }

    // FOLLOW mode: pin to bottom
    isProgrammaticScrollRef.current = true
    viewport.scrollTop = viewport.scrollHeight
  }, [viewport, streamingContent])

  /**
   * Manual Button: Jump to bottom and enter FOLLOW mode
   */
  const scrollToBottom = useCallback(() => {
    if (!viewport) return

    if (DEBUG) {
      console.log('[AutoScroll] BUTTON → FOLLOW')
    }

    isProgrammaticScrollRef.current = true
    isManualModeRef.current = false
    viewport.scrollTop = viewport.scrollHeight
    setIsAtBottom(true)
  }, [viewport])

  return { isAtBottom, scrollToBottom }
}
