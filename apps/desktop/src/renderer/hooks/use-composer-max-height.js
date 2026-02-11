import { useState, useRef, useEffect, useCallback } from 'react'
import { getComposerMaxHeight, setComposerMaxHeight as persistComposerMaxHeight } from '@renderer/lib/ui-state-db'

/**
 * Composer max height with debounced IndexedDB persistence.
 */
export function useComposerMaxHeight() {
  const [composerMaxHeight, setComposerMaxHeight] = useState(undefined)
  const timerRef = useRef(null)

  useEffect(() => {
    getComposerMaxHeight().then(setComposerMaxHeight)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const update = useCallback((maxHeight) => {
    setComposerMaxHeight(maxHeight)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => persistComposerMaxHeight(maxHeight), 300)
  }, [])

  return { composerMaxHeight, setComposerMaxHeight: update }
}
