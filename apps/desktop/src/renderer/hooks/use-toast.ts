import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Simple toast state with auto-dismiss and proper cleanup.
 *
 * Clears previous timeout before setting new message to prevent
 * stale callbacks. Cleans up on unmount to avoid memory leaks.
 */
export function useToast(defaultDuration = 4000): {
  message: string | null
  showToast: (message: string, duration?: number) => void
} {
  const [message, setMessage] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const showToast = useCallback(
    (msg: string, duration = defaultDuration) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setMessage(msg)
      timeoutRef.current = setTimeout(() => {
        setMessage(null)
        timeoutRef.current = null
      }, duration)
    },
    [defaultDuration]
  )

  return { message, showToast }
}
