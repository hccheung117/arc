import { useCallback } from 'react'
import { createId } from '@paralleldrive/cuid2'
import { useChatUIStore } from '@renderer/stores/chat-ui-store'

/** Accepted image MIME types */
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

/**
 * Convert File to ComposerAttachment with data URL preview
 */
function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve({
        id: createId(),
        file,
        preview: reader.result,
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
export function useComposerStore(threadId) {
  const composer = useChatUIStore((state) => state.getThreadState(threadId).composer)

  const setDraft = useCallback(
    (text) => {
      useChatUIStore.getState().setDraft(threadId, text)
    },
    [threadId],
  )

  const addFiles = useCallback(
    async (files) => {
      const imageFiles = Array.from(files).filter((f) => ACCEPTED_TYPES.includes(f.type))
      if (imageFiles.length === 0) return

      const newAttachments = await Promise.all(imageFiles.map(fileToAttachment))
      useChatUIStore.getState().addAttachments(threadId, newAttachments)
    },
    [threadId],
  )

  const removeAttachment = useCallback(
    (id) => {
      useChatUIStore.getState().removeAttachment(threadId, id)
    },
    [threadId],
  )

  const clear = useCallback(() => {
    useChatUIStore.getState().clearComposer(threadId)
  }, [threadId])

  const toAttachmentInputs = useCallback(async () => {
    return Promise.all(
      composer.attachments.map(async (att) => {
        // Extract base64 data from data URL
        const base64 = att.preview.split(',')[1]
        return {
          type: 'image',
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
