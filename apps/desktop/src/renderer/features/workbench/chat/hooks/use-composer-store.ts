import { useCallback } from 'react'
import { createId } from '@paralleldrive/cuid2'
import type { AttachmentInput } from '@arc-types/arc-api'
import type { ComposerAttachment } from '@renderer/features/workbench/chat/domain/types'
import { useChatUIStore } from '@renderer/features/workbench/chat/stores/chat-ui-store'

/** Accepted image MIME types */
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

/**
 * Convert File to ComposerAttachment with data URL preview
 */
function fileToAttachment(file: File): Promise<ComposerAttachment> {
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
}

/**
 * Store-backed composer hook
 *
 * Reads/writes draft and attachments from the global store.
 * State survives tab switches.
 *
 * @param threadId - The thread ID
 */
export function useComposerStore(threadId: string): {
  draft: string
  attachments: ComposerAttachment[]
  hasAttachments: boolean
  setDraft: (text: string) => void
  addFiles: (files: FileList | File[]) => Promise<void>
  removeAttachment: (id: string) => void
  clear: () => void
  toAttachmentInputs: () => Promise<AttachmentInput[]>
} {
  const composer = useChatUIStore((state) => state.getThreadState(threadId).composer)

  const setDraft = useCallback(
    (text: string) => {
      useChatUIStore.getState().setDraft(threadId, text)
    },
    [threadId],
  )

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((f) => ACCEPTED_TYPES.includes(f.type))
      if (imageFiles.length === 0) return

      const newAttachments = await Promise.all(imageFiles.map(fileToAttachment))
      useChatUIStore.getState().addAttachments(threadId, newAttachments)
    },
    [threadId],
  )

  const removeAttachment = useCallback(
    (id: string) => {
      useChatUIStore.getState().removeAttachment(threadId, id)
    },
    [threadId],
  )

  const clear = useCallback(() => {
    useChatUIStore.getState().clearComposer(threadId)
  }, [threadId])

  const toAttachmentInputs = useCallback(async (): Promise<AttachmentInput[]> => {
    return Promise.all(
      composer.attachments.map(async (att) => {
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
  }, [composer.attachments])

  return {
    draft: composer.draft,
    attachments: composer.attachments,
    hasAttachments: composer.attachments.length > 0,
    setDraft,
    addFiles,
    removeAttachment,
    clear,
    toAttachmentInputs,
  }
}
