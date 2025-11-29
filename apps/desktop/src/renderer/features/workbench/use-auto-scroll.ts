import { useEffect, useState, useCallback, useRef } from 'react'

/**
 * Smart Auto-Scroll Hook
 *
 * Implements "sticky" scroll behavior for streaming AI content.
 *
 * ## UX Contract
 *
 * The fundamental rule: **Only auto-scroll if the user is already at the bottom.**
 *
 * This distinguishes between two user modes:
 *
 * 1. **"Watching" Mode** (user at bottom)
 *    - User wants to follow the streaming content in real-time
 *    - Every new chunk should scroll the view to keep content visible
 *    - This is the default state when a conversation starts
 *
 * 2. **"Reading" Mode** (user scrolled up)
 *    - User is reviewing previous content while AI streams
 *    - Auto-scroll would be disruptive and disorienting
 *    - Content continues streaming silently below the fold
 *    - User can return to "watching" by scrolling back to bottom
 *
 * ## Threshold
 *
 * We use a 50px threshold to determine "at bottom" because:
 * - Pixel-perfect positioning (0px) is too strict; minor scroll jitter
 *   would break the sticky behavior
 * - 50px provides comfortable tolerance while still being intentional
 * - If user scrolls up more than 50px, they're clearly "reading"
 *
 * ## Why Not Use scrollIntoView or Other Native APIs?
 *
 * Native scroll APIs don't provide the conditional logic we need.
 * We must manually track position and decide whether to scroll.
 *
 * ## Why Use Element Instead of Ref?
 *
 * Using `HTMLDivElement | null` instead of `RefObject<HTMLDivElement>` ensures
 * that useEffect hooks re-run when the element mounts. With RefObject, the
 * object itself is stable and effects don't re-run when `.current` changes.
 *
 * ## Edge Cases Handled
 *
 * - Initial render: Start in "watching" mode (at bottom)
 * - Empty → first message: Scroll to show new content
 * - User sends message: Follow same smart logic (no forced scroll)
 * - Conversation switch: Reset to bottom of new conversation
 *
 * @param viewport - The scroll container element (null when not mounted)
 * @param streamingContent - Current streaming content to trigger scroll on updates
 * @returns Object with isAtBottom state and scrollToBottom function
 */

const SCROLL_THRESHOLD = 50
// Time window to respect user scroll intent before resuming auto-scroll
const USER_SCROLL_DEBOUNCE_MS = 150

interface UseAutoScrollReturn {
  isAtBottom: boolean
  scrollToBottom: () => void
}

export function useAutoScroll(
  viewport: HTMLDivElement | null,
  streamingContent: string | undefined,
  chatId?: string | null
): UseAutoScrollReturn {
  // Track whether user is at/near bottom of scroll container
  const [isAtBottom, setIsAtBottom] = useState(true)

  // Track timestamp of last user scroll to implement scroll intent debounce
  const lastUserScrollRef = useRef<number>(0)

  /**
   * Scroll listener - attaches when viewport element is available
   *
   * Updates isAtBottom state on every scroll event so the UI can
   * show/hide the scroll-to-bottom button appropriately.
   *
   * Also records timestamp for user scroll intent detection.
   */
  useEffect(() => {
    if (!viewport) return

    const handleScroll = () => {
      // Record when user scrolled - used to debounce auto-scroll
      lastUserScrollRef.current = Date.now()

      const { scrollTop, scrollHeight, clientHeight } = viewport
      const atBottom = scrollTop + clientHeight >= scrollHeight - SCROLL_THRESHOLD
      setIsAtBottom(atBottom)
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', handleScroll)
  }, [viewport])

  /**
   * Auto-scroll when chat changes or viewport mounts
   * 
   * When the user switches to a different chat, or when the scroll view
   * first mounts (e.g. after loading messages), we want to start at the bottom.
   */
  useEffect(() => {
    if (!viewport) return

    // Use requestAnimationFrame to ensure DOM has updated with new messages
    requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight
      setIsAtBottom(true)
    })
  }, [viewport, chatId])

  /**
   * Auto-scroll when streaming content changes AND user is at bottom
   *
   * This effect runs on every content update during streaming.
   * We check position at scroll-time (not using isAtBottom state) to
   * avoid stale closure issues and ensure accurate position detection.
   *
   * User scroll intent debounce: If user scrolled within the last 150ms,
   * we skip auto-scroll to let them escape the "sticky" behavior.
   */
  useEffect(() => {
    if (!viewport || streamingContent === undefined) return

    // Respect user scroll intent - don't auto-scroll if user scrolled recently
    const timeSinceUserScroll = Date.now() - lastUserScrollRef.current
    if (timeSinceUserScroll < USER_SCROLL_DEBOUNCE_MS) return

    // Check position at the moment of content update
    const { scrollTop, scrollHeight, clientHeight } = viewport
    const atBottom = scrollTop + clientHeight >= scrollHeight - SCROLL_THRESHOLD

    if (atBottom) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        viewport.scrollTop = viewport.scrollHeight
      })
    }
  }, [viewport, streamingContent])

  /**
   * Manual scroll-to-bottom for the button
   *
   * Also updates isAtBottom state so the button hides immediately.
   */
  const scrollToBottom = useCallback(() => {
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
    setIsAtBottom(true)
  }, [viewport])

  return { isAtBottom, scrollToBottom }
}
