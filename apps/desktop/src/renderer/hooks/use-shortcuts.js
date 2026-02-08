import { useState, useEffect, useCallback } from 'react'

export function useShortcuts() {
  const [shortcuts, setLocalState] = useState({ send: 'enter' })

  useEffect(() => {
    window.arc.settings.getShortcuts().then(setLocalState)
  }, [])

  const setShortcuts = useCallback((value) => {
    setLocalState(value)
    window.arc.settings.setShortcuts({ shortcuts: value })
  }, [])

  return { shortcuts, setShortcuts }
}
