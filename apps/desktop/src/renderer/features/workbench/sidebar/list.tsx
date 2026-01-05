import { useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
} from '@renderer/components/ui/sidebar'
import { DraggableThreadItem, ThreadItemOverlay } from './thread-item'
import { DraggableFolderView, FolderViewOverlay } from './folder'
import { groupThreadsWithFolders, isFolder } from './thread-grouping'
import type { ChatThread } from '@renderer/lib/threads'

// --- Pure Utilities ---

const findThreadInTree = (threads: ChatThread[], id: string): ChatThread | undefined => {
  for (const thread of threads) {
    if (thread.id === id) return thread
    const found = findThreadInTree(thread.children || [], id)
    if (found) return found
  }
  return undefined
}

type DragContext = {
  active: ChatThread
  over: ChatThread
  isTargetInFolder: boolean
  targetFolderId?: string
}

const analyzeDragContext = (
  activeId: string,
  overId: string,
  threads: ChatThread[],
  folders: ReturnType<typeof groupThreadsWithFolders>['folders']
): DragContext | null => {
  if (!activeId || !overId || activeId === overId) return null

  const active = findThreadInTree(threads, activeId)
  const over = findThreadInTree(threads, overId)

  if (!active || !over) return null

  // Check if target is inside a folder
  const targetFolderGroup = folders.find((f) =>
    f.threads.some((t) => t.id === overId)
  )

  return {
    active,
    over,
    isTargetInFolder: !!targetFolderGroup,
    targetFolderId: targetFolderGroup?.folder.id,
  }
}

// --- Component ---

interface SidebarListProps {
  threads: ChatThread[]
}

export function SidebarList({ threads }: SidebarListProps) {
  // 1. Derive Data
  const { folders, pinned, groups } = useMemo(() => groupThreadsWithFolders(threads), [threads])
  
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const activeThread = useMemo(
    () => (activeId ? findThreadInTree(threads, activeId) : null),
    [activeId, threads]
  )

  // 2. Configure Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // 3. Pure "Drop Target" Logic
  const dropTargetId = useMemo(() => {
    const ctx = activeId && overId ? analyzeDragContext(activeId, overId, threads, folders) : null
    if (!ctx) return null

    const { active, over, isTargetInFolder } = ctx

    if (isFolder(active)) return null
    if (isFolder(over)) return over.id
    
    // Check if dragging INTO a folder context
    const isDraggedInFolder = folders.some((f) => f.threads.some((t) => t.id === active.id))

    // Show indicator if we are NOT in a folder, NOT dragging from a folder, and NOT pinned
    if (!isTargetInFolder && !isDraggedInFolder && !over.isPinned) {
      return over.id
    }
    return null
  }, [activeId, overId, threads, folders])

  // 4. Event Handlers
  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(active.id as string)
  const handleDragOver = ({ over }: DragOverEvent) => setOverId(over?.id as string | null)
  const handleDragCancel = () => { setActiveId(null); setOverId(null) }

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    setOverId(null)

    const ctx = analyzeDragContext(active.id as string, over?.id as string, threads, folders)
    if (!ctx) return

    const { active: dragged, over: target, targetFolderId } = ctx
    
    // Pattern Match: Folder Dragging (Visual only)
    if (isFolder(dragged)) return

    // Pattern Match: Move to Folder (Target is Folder)
    if (isFolder(target)) {
      await window.arc.folders.moveThread(dragged.id, target.id)
      if (dragged.isPinned) await window.arc.threads.update(dragged.id, { pinned: false })
      return
    }

    // Pattern Match: Move to Folder (Target is inside Folder)
    if (targetFolderId) {
      await window.arc.folders.moveThread(dragged.id, targetFolderId)
      if (dragged.isPinned) await window.arc.threads.update(dragged.id, { pinned: false })
      return
    }

    // Pattern Match: Pin to Root (Target is Pinned)
    if (target.isPinned) {
      await window.arc.folders.moveToRoot(dragged.id)
      await window.arc.threads.update(dragged.id, { pinned: true })
      return
    }

    // Pattern Match: Merge/Sort Roots
    await window.arc.folders.moveToRoot(dragged.id)
    await window.arc.threads.update(dragged.id, { pinned: false })

    // Create folder if dropping regular thread on regular thread
    if (!target.isPinned && !isFolder(target)) {
       const folderName = `Folder ${folders.length + 1}`
       await window.arc.folders.create(folderName, dragged.id, target.id)
    }
  }

  // 5. Flattened Lists for SortableContext
  const allThreadIds = useMemo(() => [
    ...folders.map((f) => f.folder.id),
    ...folders.flatMap((f) => f.threads.map((t) => t.id)),
    ...pinned.map((t) => t.id),
    ...groups.flatMap((g) => g.threads.map((t) => t.id)),
  ], [folders, pinned, groups])

  const allGroups = useMemo(() => [
    ...(pinned.length > 0 ? [{ label: 'Pinned', threads: pinned }] : []),
    ...groups,
  ], [pinned, groups])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={allThreadIds} strategy={verticalListSortingStrategy}>
        {folders.map(({ folder, threads: folderThreads }) => (
          <DraggableFolderView
            key={folder.id}
            folder={folder}
            threads={folderThreads}
            isDropTarget={dropTargetId === folder.id}
          />
        ))}

        {allGroups.map(({ label, threads: groupThreads }) => (
          <SidebarGroup key={label} className="p-0">
            <SidebarGroupLabel>{label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {groupThreads.map((thread) => (
                  <DraggableThreadItem
                    key={thread.id}
                    thread={thread}
                    isDropTarget={dropTargetId === thread.id}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SortableContext>

      <DragOverlay>
        {activeThread ? (
          isFolder(activeThread) ? (
            <FolderViewOverlay folder={activeThread} />
          ) : (
            <ThreadItemOverlay thread={activeThread} />
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
