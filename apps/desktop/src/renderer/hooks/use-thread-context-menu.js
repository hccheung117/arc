import {
  showThreadContextMenu,
  deleteThread,
  toggleThreadPin,
  removeThreadFromFolder,
  moveThreadToFolder,
  folderThreads,
  duplicateThread,
} from '@renderer/lib/threads'

/**
 * Context menu orchestration for threads and folders
 *
 * Shows native context menu via IPC and routes action strings to appropriate domain IPC calls.
 */
export function useThreadContextMenu({ thread, folders, onRename, onFolderRename }) {
  const isFolder = thread.children !== undefined
  const isInFolder = thread.folderId !== undefined

  const handleContextMenu = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    // Filter folders list: for folders, exclude self; for threads, include all
    const filteredFolders = isFolder
      ? folders.filter((f) => f.id !== thread.id).map((f) => ({ id: f.id, title: f.title }))
      : folders.map((f) => ({ id: f.id, title: f.title }))

    const action = await showThreadContextMenu({
      isPinned: thread.isPinned,
      isInFolder: isInFolder,
      folders: filteredFolders,
    })

    if (!action) return

    // Handle each action by calling the appropriate domain IPC
    switch (action) {
      case 'rename':
        onRename()
        break
      case 'duplicate':
        // Only available for threads, not folders
        if (!isFolder) {
          await duplicateThread(thread.id)
        }
        break
      case 'delete':
        await deleteThread(thread.id)
        break
      case 'togglePin':
        await toggleThreadPin(thread.id, thread.isPinned)
        break
      case 'removeFromFolder':
        // Only available for threads in folders
        if (!isFolder && isInFolder) {
          await removeThreadFromFolder(thread.id)
        }
        break
      case 'newFolder': {
        const newFolder = await folderThreads([thread.id])
        onFolderRename(newFolder.id)
        break
      }
      default:
        // Handle moveToFolder:folderId
        if (action.startsWith('moveToFolder:')) {
          const folderId = action.slice('moveToFolder:'.length)
          await moveThreadToFolder(thread.id, folderId)
        }
    }
  }

  return { handleContextMenu }
}
