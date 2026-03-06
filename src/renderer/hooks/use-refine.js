import { useCallback, useRef, useState } from "react"

export function useRefine(value, updateDraft) {
  const [isRefining, setIsRefining] = useState(false)
  const originalRef = useRef(null)
  const abortRef = useRef(null)
  const accRef = useRef('')

  const abort = useCallback(() => {
    abortRef.current?.()
    if (isRefining) {
      updateDraft(originalRef.current)
      setIsRefining(false)
    }
  }, [isRefining, updateDraft])

  const handleRefine = useCallback(() => {
    if (isRefining) {
      abort()
      return
    }
    if (!value.trim()) return

    originalRef.current = value
    accRef.current = ''
    setIsRefining(true)

    const abortFn = window.api.call('prompt:refine', { text: value }, (chunk) => {
      if (chunk.type === 'text-delta') {
        accRef.current += chunk.delta
        updateDraft(accRef.current)
      }
      if (chunk.type === 'finish') {
        setIsRefining(false)
      }
      if (chunk.type === 'error') {
        updateDraft(originalRef.current)
        setIsRefining(false)
      }
    })
    abortRef.current = abortFn
  }, [isRefining, value, updateDraft, abort])

  return { isRefining, handleRefine, abort }
}
