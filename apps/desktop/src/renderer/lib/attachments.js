export async function openAttachment(threadId, filename) {
  const absolutePath = await window.arc.messages.getAttachmentPath({ threadId, filename })
  return window.arc.ui.openFile({ filePath: absolutePath })
}
