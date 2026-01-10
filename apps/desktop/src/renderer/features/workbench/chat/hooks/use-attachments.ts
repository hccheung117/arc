import { useState, useCallback } from 'react'
import { createId } from '@paralleldrive/cuid2'
import type { AttachmentInput } from '@arc-types/arc-api'
import type { ComposerAttachment } from '@renderer/features/workbench/chat/domain/types'

export type { ComposerAttachment }

/** Accepted image MIME types */
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

interface UseAttachmentsReturn {
  attachments: ComposerAttachment[]
  addFiles: (files: FileList | File[]) => Promise<void>
  removeAttachment: (id: string) => void
  clear: () => void
  toAttachmentInputs: () => Promise<AttachmentInput[]>
  hasAttachments: boolean
}

/**
 * Manages attachment state for the composer
 *
 * Handles:
 * - Adding files (with validation and preview generation)
 * - Removing attachments
 * - Converting to IPC-ready format
 */
export function useAttachments(): UseAttachmentsReturn {
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])

  /** Convert File to ComposerAttachment with data URL preview */
  const fileToAttachment = useCallback((file: File): Promise<ComposerAttachment> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        resolve({
          id: createId(),
          file,
          preview: reader.result as string,
          mimeType: file.type,
        })
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }, [])

  /** Add files as attachments */
  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((f) => ACCEPTED_TYPES.includes(f.type))
      if (imageFiles.length === 0) return

      const newAttachments = await Promise.all(imageFiles.map(fileToAttachment))
      setAttachments((prev) => [...prev, ...newAttachments])
    },
    [fileToAttachment],
  )

  /** Remove an attachment by ID */
  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  /** Clear all attachments */
  const clear = useCallback(() => {
    setAttachments([])
  }, [])

  /** Convert attachments to IPC-ready format */
  const toAttachmentInputs = useCallback(async (): Promise<AttachmentInput[]> => {
    return Promise.all(
      attachments.map(async (att) => {
        // Extract base64 data from data URL
        const base64 = att.preview.split(',')[1]
        return {
          type: 'image' as const,
          data: base64,
          mimeType: att.mimeType,
          name: att.file.name,
        }
      }),
    )
  }, [attachments])

  return {
    attachments,
    addFiles,
    removeAttachment,
    clear,
    toAttachmentInputs,
    hasAttachments: attachments.length > 0,
  }
}
