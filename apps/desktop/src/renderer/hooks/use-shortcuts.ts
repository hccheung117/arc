import { useState, useEffect, useCallback } from 'react'

type Shortcuts = { send: 'enter' | 'shift+enter' }

export function useShortcuts() {
  const [shortcuts, setLocalState] = useState<Shortcuts>({ send: 'enter' })

  useEffect(() => {
    window.arc.settings.getShortcuts().then(setLocalState)
  }, [])

  const setShortcuts = useCallback((value: Shortcuts) => {
    setLocalState(value)
    window.arc.settings.setShortcuts({ shortcuts: value })
  }, [])

  return { shortcuts, setShortcuts }
}
