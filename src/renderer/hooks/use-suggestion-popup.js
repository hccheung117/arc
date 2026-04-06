import { useEffect, useMemo, useRef, useState } from 'react'
import { useFloating, flip, shift } from '@floating-ui/react'
import { scanForMentions } from '../lib/composer-extensions'

export function useSuggestionPopup() {
  const [suggestion, setSuggestion] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedIndexRef = useRef(0)
  const suggestionRef = useRef(null)

  const { refs, floatingStyles } = useFloating({
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [flip(), shift({ padding: 8 })],
  })

  useEffect(() => {
    if (!suggestion?.clientRect) return
    refs.setReference({ getBoundingClientRect: suggestion.clientRect })
  }, [suggestion])

  const render = useMemo(() => () => ({
    onStart: (props) => {
      props.editor.storage.editorStore.suggestionActive = true
      suggestionRef.current = props
      setSuggestion(props)
      setSelectedIndex(0)
      selectedIndexRef.current = 0
    },
    onUpdate: (props) => {
      suggestionRef.current = props
      setSuggestion(props)
      setSelectedIndex((i) => {
        const clamped = Math.min(i, Math.max(0, props.items.length - 1))
        selectedIndexRef.current = clamped
        return clamped
      })
    },
    onExit: (props) => {
      if (!props.editor.storage.editorStore.suggestionActive) return
      props.editor.storage.editorStore.suggestionActive = false
      suggestionRef.current = null
      setSuggestion(null)
      // Direct call to scan-and-convert (no empty broadcast transaction).
      // Tagged with meta so suggestion plugins skip reactivation.
      setTimeout(() => {
        const tr = scanForMentions(props.editor)
        if (tr) {
          tr.setMeta('suggestionExit', true)
          props.editor.view.dispatch(tr)
        }
      }, 0)
    },
    onKeyDown: ({ event }) => {
      const s = suggestionRef.current
      if (!s?.items.length) return false
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => {
          const next = (i - 1 + s.items.length) % s.items.length
          selectedIndexRef.current = next
          return next
        })
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => {
          const next = (i + 1) % s.items.length
          selectedIndexRef.current = next
          return next
        })
        return true
      }
      if (event.key === 'Enter') {
        const item = s.items[selectedIndexRef.current]
        if (item) s.command(item)
        return true
      }
      return false
    },
  }), [])

  return { suggestion, selectedIndex, suggestionRef, refs, floatingStyles, render }
}
