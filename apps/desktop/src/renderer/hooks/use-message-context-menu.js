import { useCallback } from 'react'
import { warn, error } from '@renderer/lib/logger'

/**
 * Hook for handling message context menu
 */
export function useMessageContextMenu({ content, onEdit }) {
  const handleContextMenu = useCallback(
    async (e) => {
      e.preventDefault()
      e.stopPropagation()

      if (!window.arc.ui?.showMessageContextMenu) {
        warn('ui', 'Context menu API not available')
        return
      }

      try {
        const result = await window.arc.ui.showMessageContextMenu({ hasEditOption: !!onEdit })

        if (result === 'copy') {
          navigator.clipboard.writeText(content)
        } else if (result === 'edit' && onEdit) {
          onEdit(content)
        }
      } catch (err) {
        error('ui', 'Failed to show context menu', err)
      }
    },
    [content, onEdit],
  )

  return { handleContextMenu }
}
