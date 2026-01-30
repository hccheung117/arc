import { useRef, useEffect, useCallback, useState } from 'react'

const BOTTOM_THRESHOLD = 10

interface UseAutoScrollOptions {
  enabled: boolean
  content: string
  smooth?: boolean
}

/**
 * Scrolls to bottom when content changes while enabled.
 * Stops auto-scrolling once user scrolls up/away from bottom.
 * Resets when enabled changes from false to true.
 */
export function useAutoScroll(options: UseAutoScrollOptions) {
  const { enabled, content, smooth = true } = options

  const elementRef = useRef<HTMLElement | null>(null)
  const [userHasTouched, setUserHasTouched] = useState(false)
  const prevEnabledRef = useRef(enabled)
  const isScrollingRef = useRef(false)

  useEffect(() => {
    if (enabled && !prevEnabledRef.current) {
      setUserHasTouched(false)
    }
    prevEnabledRef.current = enabled
  }, [enabled])

  const isAtBottom = useCallback((el: HTMLElement): boolean => {
    const { scrollTop, scrollHeight, clientHeight } = el
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    return distanceFromBottom <= BOTTOM_THRESHOLD
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = elementRef.current
    if (!el) return

    // Flag to ignore scroll events during programmatic scroll animation
    isScrollingRef.current = true
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    })
    // Clear flag after animation could complete
    setTimeout(() => {
      isScrollingRef.current = false
    }, smooth ? 300 : 0)
  }, [smooth])

  const handleScroll = useCallback(() => {
    const el = elementRef.current
    if (!el || userHasTouched || isScrollingRef.current) return

    if (!isAtBottom(el)) {
      setUserHasTouched(true)
    }
  }, [userHasTouched, isAtBottom])

  useEffect(() => {
    if (!enabled || userHasTouched) return

    scrollToBottom()
  }, [content, enabled, userHasTouched, scrollToBottom])

  useEffect(() => {
    const el = elementRef.current
    if (!el || userHasTouched) return

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll, userHasTouched])

  const ref = useCallback((node: HTMLElement | null) => {
    elementRef.current = node
  }, [])

  const markTouched = useCallback(() => {
    setUserHasTouched(true)
  }, [])

  return { ref, userHasTouched, markTouched }
}
