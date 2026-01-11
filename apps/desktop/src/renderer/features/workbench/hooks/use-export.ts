import { useCallback } from 'react'
import type { DisplayMessage } from '@renderer/features/workbench/domain/types'
import { formatMessagesToMarkdown, generateExportFilename } from '@renderer/features/workbench/domain/export'

/**
 * Provides export functionality for chat messages.
 *
 * Shows a save dialog first, then generates markdown only if user confirms.
 */
export function useExport(messages: DisplayMessage[]) {
  return useCallback(async () => {
    const msgs = messages.map((dm) => dm.message)
    if (msgs.length === 0) return

    const filePath = await window.arc.files.showSaveDialog({
      defaultPath: generateExportFilename(),
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })

    if (filePath) {
      await window.arc.files.writeFile(filePath, formatMessagesToMarkdown(msgs))
    }
  }, [messages])
}
