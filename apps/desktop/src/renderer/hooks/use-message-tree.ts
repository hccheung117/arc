import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Message } from '@renderer/lib/messages'
import type { BranchInfo } from '@main/modules/messages/business'
import type { BranchSelections } from '@renderer/lib/types'
import { resolveTree } from '@renderer/lib/message-tree'
import { getMessages } from '@renderer/lib/messages'
import { getBranchSelections, setBranchSelection } from '@renderer/lib/ui-state-db'

interface UseMessageTreeReturn {
  /** All messages in the thread (full tree) */
  allMessages: Message[]
  /** Messages along the selected path */
  displayMessages: Message[]
  /** Branch points for navigation UI */
  branchPoints: BranchInfo[]
  /** Switch to a different branch */
  switchBranch: (parentId: string | null, index: number) => void
  /** Add a message to the tree */
  addMessage: (message: Message) => void
  /** Replace all messages (e.g., after fetch) */
  setMessages: (messages: Message[]) => void
  /** Reload messages from database */
  reload: () => Promise<void>
}

/**
 * Manage message tree state with branch selection
 */
export function useMessageTree(threadId: string): UseMessageTreeReturn {
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [branchSelections, setBranchSelections] = useState<BranchSelections>({})

  // Load messages and branch selections on mount
  useEffect(() => {
    const load = async () => {
      const [{ messages }, selections] = await Promise.all([
        getMessages(threadId),
        getBranchSelections(threadId),
      ])
      setAllMessages(messages)
      setBranchSelections(selections)
    }
    load()
  }, [threadId])

  // Compute display path using domain function
  const { path: displayMessages, branchPoints } = useMemo(
    () => resolveTree(allMessages, branchSelections),
    [allMessages, branchSelections],
  )

  const switchBranch = useCallback(
    (parentId: string | null, index: number) => {
      const key = parentId ?? 'root'
      setBranchSelections((prev) => ({ ...prev, [key]: index }))
      setBranchSelection(threadId, parentId, index)
    },
    [threadId],
  )

  const addMessage = useCallback((message: Message) => {
    setAllMessages((prev) => [...prev, message])
  }, [])

  const setMessages = useCallback((messages: Message[]) => {
    setAllMessages(messages)
  }, [])

  const reload = useCallback(async () => {
    const { messages } = await getMessages(threadId)
    setAllMessages(messages)
  }, [threadId])

  return {
    allMessages,
    displayMessages,
    branchPoints,
    switchBranch,
    addMessage,
    setMessages,
    reload,
  }
}
