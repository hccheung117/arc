import { useEffect, useCallback } from 'react'
import { useFileDrop } from './use-file-drop'
import { useToast } from './use-toast'

/**
 * Handles profile (.arc file) import from drag-drop and dock.
 *
 * Unifies two entry points:
 * - Drag-drop onto window → triggers install, errors shown here
 * - Dock drop → main process installs, emits event
 *
 * Success messages flow through profile events for both paths.
 */
export function useProfileImport(): {
  isDragging: boolean
  notification: string | null
} {
  const { message: notification, showToast } = useToast()

  const handleImport = useCallback(
    async (filePath: string) => {
      try {
        await window.arc.profiles.install({ filePath })
      } catch {
        showToast('This profile file is invalid or corrupted.')
      }
    },
    [showToast]
  )

  const handleReject = useCallback(
    (fileName: string) => {
      showToast(`Cannot install "${fileName}". Only .arc profile files are supported.`)
    },
    [showToast]
  )

  const { isDragging } = useFileDrop({
    extension: '.arc',
    onDrop: handleImport,
    onReject: handleReject,
  })

  // Subscribe to profile events (handles success for both paths)
  useEffect(() => {
    return window.arc.profiles.onInstalled((profile) => {
      showToast(`Installed profile: ${profile.name} (${profile.providerCount} providers)`)
    })
  }, [showToast])

  return { isDragging, notification }
}
