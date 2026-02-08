import { useState, useRef, useEffect } from 'react'
import { useSidebar } from '@renderer/components/sidebar-context'

export function useRename({ id, initialTitle }) {
  const { dispatch } = useSidebar()
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(initialTitle)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  const startRenaming = () => {
    setRenameValue(initialTitle)
    setIsRenaming(true)
  }

  const saveRename = async () => {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === initialTitle) {
      setIsRenaming(false)
      setRenameValue(initialTitle)
      return
    }
    await window.arc.threads.update({ threadId: id, patch: { title: trimmed } })
    dispatch({ type: 'PATCH', id, patch: { title: trimmed } })
    setIsRenaming(false)
  }

  const cancelRename = () => {
    setIsRenaming(false)
    setRenameValue(initialTitle)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelRename()
    }
  }

  return {
    isRenaming,
    renameValue,
    setRenameValue,
    inputRef,
    startRenaming,
    saveRename,
    handleKeyDown,
  }
}
