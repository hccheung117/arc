import { useState, useCallback, useEffect } from 'react'
import { info } from '@renderer/lib/logger'

/**
 * Generic hook for managing file drag/drop state.
 * Filters drops by file extension and extracts Electron file paths.
 */
export function useFileDrop({ extension, onDrop, onReject }: {
  extension: string
  onDrop: (filePath: string) => void
  onReject?: (fileName: string) => void
}): { isDragging: boolean } {
  const [isDragging, setIsDragging] = useState(false)
  const [, setDragCounter] = useState(0)

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter((c) => c + 1)
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter((c) => {
      const newCount = c - 1
      if (newCount === 0) {
        setIsDragging(false)
      }
      return newCount
    })
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      setDragCounter(0)

      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return

      const file = files[0]
      if (!file.name.toLowerCase().endsWith(extension.toLowerCase())) {
        onReject?.(file.name)
        return
      }

      // Use Electron's webUtils to get file path (contextIsolation-safe)
      const filePath = window.arc.utils.getFilePath(file)
      info('import', `File dropped: ${filePath}`)
      if (filePath) {
        onDrop(filePath)
      }
    },
    [extension, onDrop, onReject]
  )

  useEffect(() => {
    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)

    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop])

  return { isDragging }
}
